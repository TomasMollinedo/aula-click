import type { Prisma } from '@/generated/prisma/client'
import { repartoDeTurno, type Reparto } from '@/server/features/reparto/reparto.condiciones'
import {
  plazoDeAsistencia,
  type EstadoAsistencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { mesDe, primerDiaDelMes, ultimoDiaDelMes } from '@/server/shared/zod'
import {
  agruparAjustesDeAnulacion,
  armarCierre,
  armarLiquidaciones,
  estaDevengado,
  fechaDevengo,
  saldoDelProfesor,
  textoSaldoAnterior,
  type AjusteDeLiquidacion,
  type AnulacionPendiente,
  type CierreDeLiquidacion,
  type Devengado,
  type Liquidacion,
  type MesCerrado,
  type ProfesorRef,
} from './liquidaciones.reglas'

// Motor de liquidaciones (T-121, docs/convenciones-backend.md → Liquidaciones): la única
// implementación de qué turnos se le deben a cada profesor (devengo), en qué liquidación entran,
// qué ajustes arrastran (anulaciones y saldo anterior) y cuánto se le debe hoy. Las reglas son las
// puras de `liquidaciones.reglas.ts`; acá sólo se lee y se delega. No crea el cliente de Prisma
// (recibe `prisma` o el `tx` de quien llama): de Prisma sólo importa tipos (decisión T-39).
//
// - `liquidaciones` (T-124): el listado del mes (`liquidacionesDelMes`), el detalle
//   (`liquidacionDe`) y lo que se escribe al pagar (`cierreDeLiquidacion`), dentro de su `tx`.
// - `liquidaciones` (T-125): la liquidación del PDF (`liquidacionDe`).
// - "Mis ingresos" (T-126): el mes en curso del profesor (`liquidacionDe`) y todas sus
//   liquidaciones (`liquidacionesDelProfesor`).
// - `tablero` (T-128): el saldo a pagar a cada profesor (`saldoAPagarPorProfesor`) y el margen del
//   centro (`cobrosConReparto`).
//
// Nadie más calcula devengo, ajustes ni saldos, y una liquidación cerrada se lee con sus importes
// congelados: nunca se recalcula (decisión T-156).

export type ClienteLiquidaciones = Prisma.TransactionClient

export {
  ESTADOS_LIQUIDACION,
  textoMes,
  type AjusteDeLiquidacion,
  type CierreDeLiquidacion,
  type EscrituraDeCierre,
  type EstadoLiquidacion,
  type Liquidacion,
  type ProfesorRef,
  type TurnoDeLiquidacion,
} from './liquidaciones.reglas'

// ---------- Selects y conversiones ----------

const SELECT_PROFESOR = {
  id: true,
  usuario: { select: { nombre: true, apellido: true } },
} satisfies Prisma.ProfesorSelect

/** Lo que se muestra de un turno: alumno, materia y el horario y el profesor de su bloque. */
const SELECT_TURNO = {
  alumno: { select: { id: true, nombre: true, apellido: true } },
  materia: { select: { id: true, nombre: true } },
  bloqueAgenda: {
    select: { horaInicio: true, horaFin: true, profesor: { select: SELECT_PROFESOR } },
  },
} satisfies Prisma.TurnoSelect

/** Un `PagoTurno` con su pago y su turno: lo leen `leerDevengados` y `cobrosConReparto`. */
const SELECT_COBRO = {
  id: true,
  pagoId: true,
  turnoId: true,
  fechaOcurrencia: true,
  importeAplicado: true,
  porcentajeCentro: true,
  pago: { select: { createdAt: true, numeroComprobante: true, fechaPago: true } },
  turno: { select: SELECT_TURNO },
} satisfies Prisma.PagoTurnoSelect

type FilaCobro = Prisma.PagoTurnoGetPayload<{ select: typeof SELECT_COBRO }>

function aProfesor(
  fila: Prisma.ProfesorGetPayload<{ select: typeof SELECT_PROFESOR }>,
): ProfesorRef {
  return { id: fila.id, nombre: fila.usuario.nombre, apellido: fila.usuario.apellido }
}

/** `Liquidacion.mes` (`@db.Date`, el día 1) → `YYYY-MM`. */
const aMes = (date: Date) => mesDe(dateAFecha(date))

const claveOcurrencia = (turnoId: number, fecha: Date) => `${turnoId}|${dateAFecha(fecha)}`

type AsistenciaLeida = { estado: EstadoAsistencia; createdAt: Date }

/**
 * Las asistencias de los turnos de `filas`, por `claveOcurrencia(turnoId, fecha)`. Una consulta
 * (ninguna si no hay filas), sin importar cuántos turnos.
 */
async function leerAsistencias(
  client: ClienteLiquidaciones,
  filas: readonly Pick<FilaCobro, 'turnoId'>[],
): Promise<Map<string, AsistenciaLeida>> {
  const turnoIds = [...new Set(filas.map((fila) => fila.turnoId))]
  if (turnoIds.length === 0) return new Map()
  const asistencias = await client.asistenciaTurno.findMany({
    where: { turnoId: { in: turnoIds } },
    select: { turnoId: true, fechaOcurrencia: true, estado: true, createdAt: true },
  })
  return new Map(
    asistencias.map((a) => [
      claveOcurrencia(a.turnoId, a.fechaOcurrencia),
      { estado: a.estado, createdAt: a.createdAt },
    ]),
  )
}

// ---------- Lecturas base ----------

/**
 * Los turnos devengados hasta `hasta` (`YYYY-MM-DD`, inclusive) que no están en una liquidación
 * cerrada: `PagoTurno` vigente, sin `LiquidacionTurno`, con asistencia `PRESENTE` o `AUSENTE`. La
 * fecha de devengo usa el **registro** del pago y de la asistencia (`createdAt`), nunca `fechaPago`.
 * El profesor es el del bloque al leer. Dos consultas, sin importar cuántos turnos; el devengo y el
 * filtro por fecha, en memoria (lo sin liquidar es poco: lo liquidado sale).
 */
export async function leerDevengados(
  client: ClienteLiquidaciones,
  { profesorId, hasta }: { profesorId?: number; hasta: string },
): Promise<Devengado[]> {
  const filas = await client.pagoTurno.findMany({
    where: {
      vigente: true,
      liquidacionTurno: { is: null },
      ...(profesorId === undefined ? {} : { turno: { bloqueAgenda: { profesorId } } }),
    },
    select: SELECT_COBRO,
    orderBy: { id: 'asc' },
  })
  const asistencias = await leerAsistencias(client, filas)
  return filas.flatMap((fila): Devengado[] => {
    const asistencia = asistencias.get(claveOcurrencia(fila.turnoId, fila.fechaOcurrencia))
    if (!asistencia || !estaDevengado({ pagoVigente: true, asistencia: asistencia.estado })) {
      return []
    }
    const devengo = fechaDevengo({
      pagoRegistradoEl: fila.pago.createdAt,
      asistenciaRegistradaEl: asistencia.createdAt,
    })
    if (devengo > hasta) return []
    const { alumno, materia, bloqueAgenda } = fila.turno
    return [
      {
        pagoTurnoId: fila.id,
        turnoId: fila.turnoId,
        fecha: dateAFecha(fila.fechaOcurrencia),
        horaInicio: bloqueAgenda.horaInicio,
        horaFin: bloqueAgenda.horaFin,
        alumno,
        materia,
        profesor: aProfesor(bloqueAgenda.profesor),
        numeroComprobante: fila.pago.numeroComprobante,
        importe: fila.importeAplicado.toNumber(),
        porcentaje: fila.porcentajeCentro.toNumber(),
        fechaDevengo: devengo,
      },
    ]
  })
}

/**
 * Los turnos de liquidaciones cerradas cuyo pago se anuló después y que todavía no tienen su
 * `AjusteLiquidacion`, con la parte del profesor congelada. Un pago anulado deja `vigente` en
 * `null` (decisión T-133). Una consulta.
 */
export async function leerAnulacionesPendientes(
  client: ClienteLiquidaciones,
  { profesorId }: { profesorId?: number } = {},
): Promise<AnulacionPendiente[]> {
  const filas = await client.liquidacionTurno.findMany({
    where: {
      pagoTurno: { vigente: null },
      ajuste: { is: null },
      ...(profesorId === undefined ? {} : { liquidacion: { profesorId } }),
    },
    select: {
      id: true,
      parteProfesor: true,
      liquidacion: { select: { mes: true, profesor: { select: SELECT_PROFESOR } } },
      pagoTurno: { select: { pago: { select: { numeroComprobante: true } } } },
    },
    orderBy: { id: 'asc' },
  })
  return filas.map((fila) => ({
    liquidacionTurnoId: fila.id,
    profesor: aProfesor(fila.liquidacion.profesor),
    mesOrigen: aMes(fila.liquidacion.mes),
    numeroComprobante: fila.pagoTurno.pago.numeroComprobante,
    parteProfesor: fila.parteProfesor.toNumber(),
  }))
}

/** Qué meses de cada profesor ya están cerrados: lo único que `armarLiquidaciones` necesita. */
async function leerMesesCerrados(
  client: ClienteLiquidaciones,
  { profesorId }: { profesorId?: number },
): Promise<MesCerrado[]> {
  const filas = await client.liquidacion.findMany({
    where: profesorId === undefined ? {} : { profesorId },
    select: { profesorId: true, mes: true },
  })
  return filas.map((fila) => ({ profesorId: fila.profesorId, mes: aMes(fila.mes) }))
}

const SELECT_CERRADA = {
  id: true,
  mes: true,
  estado: true,
  totalCobrado: true,
  parteCentro: true,
  parteProfesor: true,
  totalAjustes: true,
  total: true,
  fechaTransferencia: true,
  numeroOperacion: true,
  observaciones: true,
  createdAt: true,
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  profesor: { select: SELECT_PROFESOR },
  descontadaEn: { select: { mes: true } },
  turnos: {
    select: {
      fechaDevengo: true,
      importe: true,
      porcentajeCentro: true,
      parteProfesor: true,
      pagoTurno: {
        select: {
          id: true,
          turnoId: true,
          fechaOcurrencia: true,
          pago: { select: { numeroComprobante: true } },
          turno: { select: SELECT_TURNO },
        },
      },
    },
    orderBy: [
      { pagoTurno: { fechaOcurrencia: 'asc' } },
      { pagoTurno: { turno: { bloqueAgenda: { horaInicio: 'asc' } } } },
      { pagoTurno: { turnoId: 'asc' } },
    ],
  },
  ajustesAplicados: {
    select: {
      tipo: true,
      importe: true,
      liquidacionTurnoId: true,
      liquidacionTurno: {
        select: { pagoTurno: { select: { pago: { select: { numeroComprobante: true } } } } },
      },
      liquidacionOrigen: { select: { mes: true } },
    },
  },
} satisfies Prisma.LiquidacionSelect

type FilaCerrada = Prisma.LiquidacionGetPayload<{ select: typeof SELECT_CERRADA }>

const aCentavos = (importe: number) => Math.round(importe * 100)

function aCerrada(fila: FilaCerrada): Liquidacion {
  const saldos: AjusteDeLiquidacion[] = []
  const anulaciones: Parameters<typeof agruparAjustesDeAnulacion>[0][number][] = []
  for (const ajuste of fila.ajustesAplicados) {
    const importe = ajuste.importe.toNumber()
    if (ajuste.tipo === 'SALDO_ANTERIOR' && ajuste.liquidacionOrigen) {
      const mesOrigen = aMes(ajuste.liquidacionOrigen.mes)
      saldos.push({
        tipo: 'SALDO_ANTERIOR',
        texto: textoSaldoAnterior(mesOrigen),
        importe,
        mesOrigen,
      })
    } else if (
      ajuste.tipo === 'ANULACION' &&
      ajuste.liquidacionTurno &&
      ajuste.liquidacionTurnoId
    ) {
      anulaciones.push({
        liquidacionTurnoId: ajuste.liquidacionTurnoId,
        numeroComprobante: ajuste.liquidacionTurno.pagoTurno.pago.numeroComprobante,
        parteProfesor: -importe,
      })
    }
  }
  return {
    profesor: aProfesor(fila.profesor),
    mes: aMes(fila.mes),
    estado: fila.estado,
    turnos: fila.turnos.map((turno) => {
      const { pagoTurno } = turno
      const { alumno, materia, bloqueAgenda } = pagoTurno.turno
      const importe = turno.importe.toNumber()
      const parteProfesor = turno.parteProfesor.toNumber()
      return {
        pagoTurnoId: pagoTurno.id,
        turnoId: pagoTurno.turnoId,
        fecha: dateAFecha(pagoTurno.fechaOcurrencia),
        horaInicio: bloqueAgenda.horaInicio,
        horaFin: bloqueAgenda.horaFin,
        alumno,
        materia,
        numeroComprobante: pagoTurno.pago.numeroComprobante,
        importe,
        porcentaje: turno.porcentajeCentro.toNumber(),
        fechaDevengo: dateAFecha(turno.fechaDevengo),
        parteCentro: (aCentavos(importe) - aCentavos(parteProfesor)) / 100,
        parteProfesor,
      }
    }),
    ajustes: [...saldos, ...agruparAjustesDeAnulacion(anulaciones)],
    totalCobrado: fila.totalCobrado.toNumber(),
    parteCentro: fila.parteCentro.toNumber(),
    parteProfesor: fila.parteProfesor.toNumber(),
    totalAjustes: fila.totalAjustes.toNumber(),
    total: fila.total.toNumber(),
    cerrada: {
      id: fila.id,
      fechaTransferencia: fila.fechaTransferencia ? dateAFecha(fila.fechaTransferencia) : null,
      numeroOperacion: fila.numeroOperacion,
      observaciones: fila.observaciones,
      descontadaEnMes: fila.descontadaEn ? aMes(fila.descontadaEn.mes) : null,
      registradaPor: fila.createdBy,
      registradaEl: fila.createdAt.toISOString(),
    },
  }
}

/**
 * Las liquidaciones cerradas (`PAGADA` o `DESCONTADA`), con sus turnos, ajustes e importes tal como
 * se guardaron: no se recalculan. `desde` / `hasta` son meses `YYYY-MM` (inclusive). Una consulta
 * con `select` anidado (Prisma resuelve las relaciones por lote, sin N+1). Ordenadas por mes.
 */
export async function leerLiquidacionesCerradas(
  client: ClienteLiquidaciones,
  { profesorId, desde, hasta }: { profesorId?: number; desde?: string; hasta?: string } = {},
): Promise<Liquidacion[]> {
  const filas = await client.liquidacion.findMany({
    where: {
      ...(profesorId === undefined ? {} : { profesorId }),
      ...(desde === undefined && hasta === undefined
        ? {}
        : {
            mes: {
              ...(desde === undefined ? {} : { gte: fechaADate(primerDiaDelMes(desde)) }),
              ...(hasta === undefined ? {} : { lte: fechaADate(ultimoDiaDelMes(hasta)) }),
            },
          }),
    },
    select: SELECT_CERRADA,
    orderBy: [{ mes: 'asc' }, { profesorId: 'asc' }],
  })
  return filas.map(aCerrada)
}

// ---------- Lecturas para las features ----------

/** Las liquidaciones abiertas de hoy (de un profesor o de todos): las lecturas y `armarLiquidaciones`. */
async function calcularAbiertas(
  client: ClienteLiquidaciones,
  { profesorId, hoy }: { profesorId?: number; hoy: string },
): Promise<Liquidacion[]> {
  const [devengados, liquidacionesCerradas, anulacionesPendientes] = await Promise.all([
    leerDevengados(client, { profesorId, hasta: hoy }),
    leerMesesCerrados(client, { profesorId }),
    leerAnulacionesPendientes(client, { profesorId }),
  ])
  return armarLiquidaciones({ devengados, liquidacionesCerradas, anulacionesPendientes, hoy })
}

// Mismo orden de profesores que `armarLiquidaciones`: apellido, nombre e id.
function porProfesor(a: Liquidacion, b: Liquidacion): number {
  return (
    a.profesor.apellido.localeCompare(b.profesor.apellido, 'es') ||
    a.profesor.nombre.localeCompare(b.profesor.nombre, 'es') ||
    a.profesor.id - b.profesor.id
  )
}

/**
 * Las liquidaciones del `mes` (`YYYY-MM`) de cada profesor (o de `profesorId`): la cerrada si la
 * hay, si no la abierta; nunca las dos. Ordenadas por profesor. Un mes posterior al de `hoy` → `[]`.
 */
export async function liquidacionesDelMes(
  client: ClienteLiquidaciones,
  { mes, profesorId, hoy }: { mes: string; profesorId?: number; hoy: string },
): Promise<Liquidacion[]> {
  if (mes > mesDe(hoy)) return []
  const [cerradas, abiertas] = await Promise.all([
    leerLiquidacionesCerradas(client, { profesorId, desde: mes, hasta: mes }),
    calcularAbiertas(client, { profesorId, hoy }),
  ])
  const conCerrada = new Set(cerradas.map((l) => l.profesor.id))
  return [
    ...cerradas,
    ...abiertas.filter((l) => l.mes === mes && !conCerrada.has(l.profesor.id)),
  ].sort(porProfesor)
}

/** La liquidación de `profesorId` en `mes` (cerrada o abierta), o `null` si no tiene movimientos. */
export async function liquidacionDe(
  client: ClienteLiquidaciones,
  { profesorId, mes, hoy }: { profesorId: number; mes: string; hoy: string },
): Promise<Liquidacion | null> {
  const [liquidacion] = await liquidacionesDelMes(client, { mes, profesorId, hoy })
  return liquidacion ?? null
}

/**
 * Todas las liquidaciones de `profesorId` hasta el mes de `hoy`, una por mes con movimientos: la
 * cerrada si la hay (congelada), si no la abierta; nunca las dos. Ordenadas por mes. Las lee "Mis
 * liquidaciones" del profesor (T-126), con el mismo cálculo que el detalle del gerente.
 */
export async function liquidacionesDelProfesor(
  client: ClienteLiquidaciones,
  { profesorId, hoy }: { profesorId: number; hoy: string },
): Promise<Liquidacion[]> {
  const [cerradas, abiertas] = await Promise.all([
    leerLiquidacionesCerradas(client, { profesorId }),
    calcularAbiertas(client, { profesorId, hoy }),
  ])
  const mesesCerrados = new Set(cerradas.map((l) => l.mes))
  return [...cerradas, ...abiertas.filter((l) => !mesesCerrados.has(l.mes))].sort((a, b) =>
    a.mes.localeCompare(b.mes),
  )
}

/**
 * Lo que se le debe hoy a cada profesor con alguna liquidación abierta (`saldoDelProfesor`), por
 * profesor. Puede ser negativo: el tablero decide qué suma.
 */
export async function saldoAPagarPorProfesor(
  client: ClienteLiquidaciones,
  { hoy }: { hoy: string },
): Promise<{ profesor: ProfesorRef; saldo: number }[]> {
  const porProfesorId = new Map<number, Liquidacion[]>()
  for (const liquidacion of await calcularAbiertas(client, { hoy })) {
    const id = liquidacion.profesor.id
    porProfesorId.set(id, [...(porProfesorId.get(id) ?? []), liquidacion])
  }
  return [...porProfesorId.values()].map((abiertas) => ({
    profesor: abiertas[0].profesor,
    saldo: saldoDelProfesor(abiertas),
  }))
}

/** Un cobro de un turno con su reparto, para el margen del centro (T-128). */
export type CobroConReparto = {
  pagoTurnoId: number
  pagoId: number
  numeroComprobante: number
  fechaPago: string
  fechaOcurrencia: string
  /** El del bloque al leer. */
  profesor: ProfesorRef
  reparto: Reparto
  /** Sin asistencia y con el plazo vencido (`plazoDeAsistencia`): el importe queda para el centro. */
  cerradaSinRegistrar: boolean
}

/**
 * Los `PagoTurno` vigentes con `fechaPago` en `[desde, hasta]` (`YYYY-MM-DD`), con su reparto al
 * porcentaje del cobro y si la ocurrencia quedó cerrada sin registrar a `hoy`. Dos consultas.
 */
export async function cobrosConReparto(
  client: ClienteLiquidaciones,
  { desde, hasta, hoy }: { desde: string; hasta: string; hoy: string },
): Promise<CobroConReparto[]> {
  const filas = await client.pagoTurno.findMany({
    where: {
      vigente: true,
      pago: { fechaPago: { gte: fechaADate(desde), lte: fechaADate(hasta) } },
    },
    select: SELECT_COBRO,
    orderBy: { id: 'asc' },
  })
  const asistencias = await leerAsistencias(client, filas)
  return filas.map((fila) => {
    const fechaOcurrencia = dateAFecha(fila.fechaOcurrencia)
    const asistencia = asistencias.get(claveOcurrencia(fila.turnoId, fila.fechaOcurrencia))
    return {
      pagoTurnoId: fila.id,
      pagoId: fila.pagoId,
      numeroComprobante: fila.pago.numeroComprobante,
      fechaPago: dateAFecha(fila.pago.fechaPago),
      fechaOcurrencia,
      profesor: aProfesor(fila.turno.bloqueAgenda.profesor),
      reparto: repartoDeTurno(fila.importeAplicado.toNumber(), fila.porcentajeCentro.toNumber()),
      cerradaSinRegistrar: !asistencia && plazoDeAsistencia(fechaOcurrencia, hoy).vencido,
    }
  })
}

/**
 * Lo que hay que escribir para pagar la liquidación de `profesorId` en `mes` (`armarCierre`), o
 * `null` si no está pendiente de pago. No escribe: la escritura es del repository de `liquidaciones`
 * (T-124), en su transacción y con su `tx`.
 */
export async function cierreDeLiquidacion(
  client: ClienteLiquidaciones,
  { profesorId, mes, hoy }: { profesorId: number; mes: string; hoy: string },
): Promise<CierreDeLiquidacion | null> {
  return armarCierre(await calcularAbiertas(client, { profesorId, hoy }), { profesorId, mes })
}
