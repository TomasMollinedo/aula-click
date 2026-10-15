import { repartoDeTurno, sumarReparto } from '@/server/features/reparto/reparto.condiciones'
import type { EstadoAsistencia } from '@/server/features/turnos/ocurrencias.condiciones'
import type { UsuarioAuditoria } from '@/server/shared/auditoria'
import { fechaADate, fechaEnZona } from '@/server/shared/fechas'
import { mesDe, mesSiguiente, primerDiaDelMes } from '@/server/shared/zod'

// Motor de liquidaciones (T-121, docs/sprint-3/sprint-3.md → Vocabulario de la ampliación): qué
// turnos se le deben a cada profesor, en qué mes, qué ajustes arrastra cada liquidación abierta y
// qué se escribe al cerrarla. Puro: sin Prisma ni `hoy()`; `liquidaciones.condiciones.ts` lee los
// datos y llama a estas reglas, y nadie más las recalcula. Los importes entran y salen en pesos
// (`number`) y se suman en centavos enteros (convenciones-backend.md → Importes); el reparto de
// cada turno es el de `reparto` (decisión T-161).

export const ESTADOS_LIQUIDACION = [
  'EN_CURSO',
  'PENDIENTE_DE_PAGO',
  'SALDO_A_DESCONTAR',
  'PAGADA',
  'DESCONTADA',
] as const
export type EstadoLiquidacion = (typeof ESTADOS_LIQUIDACION)[number]

export type ProfesorRef = { id: number; nombre: string; apellido: string }

/** Un turno devengado que todavía no está en una liquidación cerrada. */
export type Devengado = {
  pagoTurnoId: number
  turnoId: number
  /** Fecha de la ocurrencia (`YYYY-MM-DD`). */
  fecha: string
  /** Minutos desde medianoche, como en `Ocurrencia`. */
  horaInicio: number
  horaFin: number
  alumno: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
  /** El del bloque del turno al leerlo. */
  profesor: ProfesorRef
  numeroComprobante: number
  importe: number
  porcentaje: number
  /** `fechaDevengo(...)` (`YYYY-MM-DD`). */
  fechaDevengo: string
}

/** Un turno de una liquidación cerrada cuyo pago se anuló y que todavía no tiene su ajuste. */
export type AnulacionPendiente = {
  liquidacionTurnoId: number
  profesor: ProfesorRef
  /** Mes (`YYYY-MM`) de la liquidación cerrada que incluyó el turno. */
  mesOrigen: string
  numeroComprobante: number
  /** La parte del profesor congelada en `LiquidacionTurno`. */
  parteProfesor: number
}

/** Un mes ya cerrado (`PAGADA` o `DESCONTADA`) de un profesor. */
export type MesCerrado = { profesorId: number; mes: string }

export type TurnoDeLiquidacion = Omit<Devengado, 'profesor'> & {
  parteCentro: number
  parteProfesor: number
}

export type AjusteDeLiquidacion =
  | {
      tipo: 'ANULACION'
      texto: string
      importe: number
      numeroComprobante: number
      turnos: { liquidacionTurnoId: number; parteProfesor: number }[]
    }
  | { tipo: 'SALDO_ANTERIOR'; texto: string; importe: number; mesOrigen: string }

type AjusteAnulacion = Extract<AjusteDeLiquidacion, { tipo: 'ANULACION' }>
type AjusteSaldo = Extract<AjusteDeLiquidacion, { tipo: 'SALDO_ANTERIOR' }>

/** Una liquidación abierta (calculada, `cerrada: null`) o cerrada (leída): la misma forma. */
export type Liquidacion = {
  profesor: ProfesorRef
  mes: string
  estado: EstadoLiquidacion
  turnos: TurnoDeLiquidacion[]
  ajustes: AjusteDeLiquidacion[]
  totalCobrado: number
  parteCentro: number
  parteProfesor: number
  totalAjustes: number
  total: number
  cerrada: null | {
    id: number
    fechaTransferencia: string | null
    numeroOperacion: string | null
    observaciones: string | null
    descontadaEnMes: string | null
    /** Quien registró el pago (`createdBy`). */
    registradaPor: UsuarioAuditoria
    /** `createdAt`, ISO UTC. */
    registradaEl: string
  }
}

/** Una liquidación a guardar al cerrar (la paga o una que absorbe como `DESCONTADA`). */
export type EscrituraDeCierre = {
  mes: string
  estado: 'PAGADA' | 'DESCONTADA'
  descontadaEnMes: string | null
  totalCobrado: number
  parteCentro: number
  parteProfesor: number
  totalAjustes: number
  total: number
  turnos: {
    pagoTurnoId: number
    fechaDevengo: string
    importe: number
    porcentaje: number
    parteProfesor: number
  }[]
  ajustes: (
    | { tipo: 'ANULACION'; liquidacionTurnoId: number; importe: number }
    | { tipo: 'SALDO_ANTERIOR'; mesOrigen: string; importe: number }
  )[]
}

export type CierreDeLiquidacion = {
  liquidacion: Liquidacion
  /** De la más vieja a la más nueva: las `DESCONTADA` primero, la `PAGADA` al final. */
  escrituras: EscrituraDeCierre[]
}

const aCentavos = (importe: number) => Math.round(importe * 100)

function sumarImportes(importes: readonly number[]): number {
  return importes.reduce((total, importe) => total + aCentavos(importe), 0) / 100
}

// ---------- Devengo ----------

/**
 * Fecha de devengo: la más tardía entre el registro del pago y el de la asistencia, como fecha de
 * Salta. Cuenta el registro (no la fecha de pago, que se puede cargar hacia atrás): así un turno
 * nunca cae en un mes ya liquidado.
 */
export function fechaDevengo({
  pagoRegistradoEl,
  asistenciaRegistradaEl,
}: {
  pagoRegistradoEl: Date
  asistenciaRegistradaEl: Date
}): string {
  const masTardio =
    pagoRegistradoEl.getTime() >= asistenciaRegistradaEl.getTime()
      ? pagoRegistradoEl
      : asistenciaRegistradaEl
  return fechaEnZona(masTardio)
}

/**
 * Si el turno se le debe al profesor: pago vigente y asistencia `PRESENTE` o `AUSENTE`. Sin
 * asistencia (dentro del plazo o cerrado sin registrar) no se devenga.
 */
export function estaDevengado({
  pagoVigente,
  asistencia,
}: {
  pagoVigente: boolean
  asistencia: EstadoAsistencia | null
}): boolean {
  return pagoVigente && (asistencia === 'PRESENTE' || asistencia === 'AUSENTE')
}

// ---------- Textos ----------

const formatoMes = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `"2026-10"` → "octubre de 2026". Lanza `RangeError` si no es un mes `YYYY-MM` válido. */
export function textoMes(mes: string): string {
  return formatoMes.format(fechaADate(primerDiaDelMes(mes)))
}

/** "Ajuste por anulación del comprobante N.º 123 (2 turnos)". */
export function textoAjusteAnulacion(numeroComprobante: number, cantidadTurnos: number): string {
  const turnos = cantidadTurnos === 1 ? '1 turno' : `${cantidadTurnos} turnos`
  return `Ajuste por anulación del comprobante N.º ${numeroComprobante} (${turnos})`
}

/** "Saldo de la liquidación de octubre de 2026". */
export function textoSaldoAnterior(mesOrigen: string): string {
  return `Saldo de la liquidación de ${textoMes(mesOrigen)}`
}

/**
 * Agrupa turnos anulados por comprobante: una línea `ANULACION` por comprobante, con importe
 * −Σ `parteProfesor` y sus turnos, ordenadas por número de comprobante. La usan las abiertas y la
 * lectura de las cerradas: el texto se arma acá.
 */
export function agruparAjustesDeAnulacion(
  anulaciones: readonly Pick<
    AnulacionPendiente,
    'liquidacionTurnoId' | 'numeroComprobante' | 'parteProfesor'
  >[],
): AjusteAnulacion[] {
  const porComprobante = new Map<number, { liquidacionTurnoId: number; parteProfesor: number }[]>()
  for (const { liquidacionTurnoId, numeroComprobante, parteProfesor } of anulaciones) {
    const turnos = porComprobante.get(numeroComprobante) ?? []
    turnos.push({ liquidacionTurnoId, parteProfesor })
    porComprobante.set(numeroComprobante, turnos)
  }
  return [...porComprobante.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numeroComprobante, turnos]) => ({
      tipo: 'ANULACION',
      texto: textoAjusteAnulacion(numeroComprobante, turnos.length),
      importe: -sumarImportes(turnos.map((turno) => turno.parteProfesor)),
      numeroComprobante,
      turnos: [...turnos].sort((a, b) => a.liquidacionTurnoId - b.liquidacionTurnoId),
    }))
}

// ---------- Liquidaciones abiertas ----------

type MesEnArmado = {
  turnos: TurnoDeLiquidacion[]
  anulaciones: AnulacionPendiente[]
  saldo: AjusteSaldo | null
}

function compararTurnos(a: TurnoDeLiquidacion, b: TurnoDeLiquidacion): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  return a.horaInicio - b.horaInicio || a.turnoId - b.turnoId
}

function compararProfesores(a: ProfesorRef, b: ProfesorRef): number {
  return (
    a.apellido.localeCompare(b.apellido, 'es') ||
    a.nombre.localeCompare(b.nombre, 'es') ||
    a.id - b.id
  )
}

function armarDelProfesor(
  profesor: ProfesorRef,
  devengados: readonly Omit<Devengado, 'profesor'>[],
  anulaciones: readonly AnulacionPendiente[],
  cerrados: ReadonlySet<string>,
  mesActual: string,
): Liquidacion[] {
  const meses = new Map<string, MesEnArmado>()
  const delMes = (mes: string) => {
    let armado = meses.get(mes)
    if (!armado) {
      armado = { turnos: [], anulaciones: [], saldo: null }
      meses.set(mes, armado)
    }
    return armado
  }
  const siguienteSinCerrar = (mes: string) => {
    let siguiente = mesSiguiente(mes)
    while (cerrados.has(siguiente)) siguiente = mesSiguiente(siguiente)
    return siguiente
  }

  // 1. Cada turno, al mes de su devengo (si estuviera cerrado, al siguiente sin cerrar).
  for (const devengado of devengados) {
    const mes = mesDe(devengado.fechaDevengo)
    const reparto = repartoDeTurno(devengado.importe, devengado.porcentaje)
    delMes(cerrados.has(mes) ? siguienteSinCerrar(mes) : mes).turnos.push({
      ...devengado,
      parteCentro: reparto.parteCentro,
      parteProfesor: reparto.parteProfesor,
    })
  }

  // 2. Cada anulación, a la primera liquidación con turnos posterior a su origen, o al mes en curso.
  const mesesConTurnos = [...meses.keys()].sort()
  for (const anulacion of anulaciones) {
    const destino = mesesConTurnos.find((mes) => mes > anulacion.mesOrigen) ?? mesActual
    delMes(destino).anulaciones.push(anulacion)
  }

  // 3 a 5. En orden ascendente: totales, estado y, si un mes terminado da ≤ 0, su saldo al
  // siguiente sin cerrar (que se crea si hace falta y se evalúa después, así se encadena).
  const liquidaciones: Liquidacion[] = []
  const orden = [...meses.keys()].sort()
  for (const mes of orden) {
    const armado = delMes(mes)
    const turnos = [...armado.turnos].sort(compararTurnos)
    const ajustes: AjusteDeLiquidacion[] = [
      ...(armado.saldo ? [armado.saldo] : []),
      ...agruparAjustesDeAnulacion(armado.anulaciones),
    ]
    const reparto = sumarReparto(turnos)
    const totalAjustes = sumarImportes(ajustes.map((ajuste) => ajuste.importe))
    const total = sumarImportes([reparto.parteProfesor, totalAjustes])
    const estado: EstadoLiquidacion =
      mes === mesActual ? 'EN_CURSO' : total > 0 ? 'PENDIENTE_DE_PAGO' : 'SALDO_A_DESCONTAR'
    liquidaciones.push({
      profesor,
      mes,
      estado,
      turnos,
      ajustes,
      totalCobrado: reparto.importe,
      parteCentro: reparto.parteCentro,
      parteProfesor: reparto.parteProfesor,
      totalAjustes,
      total,
      cerrada: null,
    })
    if (estado === 'SALDO_A_DESCONTAR') {
      // El destino es posterior a `mes`: agregarlo y reordenar no cambia lo ya recorrido, y el
      // `for…of` de un array lo alcanza aunque se agregue durante el recorrido.
      const destino = siguienteSinCerrar(mes)
      if (!meses.has(destino)) {
        orden.push(destino)
        orden.sort()
      }
      delMes(destino).saldo = {
        tipo: 'SALDO_ANTERIOR',
        texto: textoSaldoAnterior(mes),
        importe: total,
        mesOrigen: mes,
      }
    }
  }
  return liquidaciones
}

/**
 * Las liquidaciones abiertas (`cerrada: null`) de cada profesor, con sus turnos, ajustes, totales
 * y estado. `hoy` es `YYYY-MM-DD`; `liquidacionesCerradas` sólo dice qué meses de cada profesor ya
 * están cerrados. Sólo aparecen meses con algún movimiento, nunca uno posterior al de `hoy`. Orden:
 * profesor (apellido, nombre, id) y mes ascendente.
 */
export function armarLiquidaciones({
  devengados,
  liquidacionesCerradas,
  anulacionesPendientes,
  hoy,
}: {
  devengados: readonly Devengado[]
  liquidacionesCerradas: readonly MesCerrado[]
  anulacionesPendientes: readonly AnulacionPendiente[]
  hoy: string
}): Liquidacion[] {
  const mesActual = mesDe(hoy)
  const profesores = new Map<number, ProfesorRef>()
  const turnosPorProfesor = new Map<number, Omit<Devengado, 'profesor'>[]>()
  for (const { profesor, ...turno } of devengados) {
    profesores.set(profesor.id, profesores.get(profesor.id) ?? profesor)
    turnosPorProfesor.set(profesor.id, [...(turnosPorProfesor.get(profesor.id) ?? []), turno])
  }
  for (const { profesor } of anulacionesPendientes) {
    profesores.set(profesor.id, profesores.get(profesor.id) ?? profesor)
  }
  return [...profesores.values()].sort(compararProfesores).flatMap((profesor) =>
    armarDelProfesor(
      profesor,
      turnosPorProfesor.get(profesor.id) ?? [],
      anulacionesPendientes.filter((anulacion) => anulacion.profesor.id === profesor.id),
      new Set(
        liquidacionesCerradas
          .filter((cerrada) => cerrada.profesorId === profesor.id)
          .map((cerrada) => cerrada.mes),
      ),
      mesActual,
    ),
  )
}

/**
 * Lo que se le debe hoy a un profesor: la suma de los `total` de sus abiertas `PENDIENTE_DE_PAGO`
 * y `EN_CURSO`. Las `SALDO_A_DESCONTAR` no se cuentan: ya están sumadas en la del mes siguiente.
 * Puede dar negativo.
 */
export function saldoDelProfesor(abiertas: readonly Liquidacion[]): number {
  return sumarImportes(
    abiertas
      .filter((l) => l.estado === 'PENDIENTE_DE_PAGO' || l.estado === 'EN_CURSO')
      .map((l) => l.total),
  )
}

// ---------- Cierre ----------

function escrituraDe(
  liquidacion: Liquidacion,
  estado: EscrituraDeCierre['estado'],
  descontadaEnMes: string | null,
): EscrituraDeCierre {
  return {
    mes: liquidacion.mes,
    estado,
    descontadaEnMes,
    totalCobrado: liquidacion.totalCobrado,
    parteCentro: liquidacion.parteCentro,
    parteProfesor: liquidacion.parteProfesor,
    totalAjustes: liquidacion.totalAjustes,
    total: liquidacion.total,
    turnos: liquidacion.turnos.map(
      ({ pagoTurnoId, fechaDevengo, importe, porcentaje, parteProfesor }) => ({
        pagoTurnoId,
        fechaDevengo,
        importe,
        porcentaje,
        parteProfesor,
      }),
    ),
    ajustes: liquidacion.ajustes.flatMap((ajuste): EscrituraDeCierre['ajustes'] =>
      ajuste.tipo === 'SALDO_ANTERIOR'
        ? [{ tipo: 'SALDO_ANTERIOR', mesOrigen: ajuste.mesOrigen, importe: ajuste.importe }]
        : ajuste.turnos.map(({ liquidacionTurnoId, parteProfesor }) => ({
            tipo: 'ANULACION',
            liquidacionTurnoId,
            importe: -parteProfesor,
          })),
    ),
  }
}

/**
 * Lo que hay que escribir para pagar la liquidación `mes` de `profesorId`: `null` si entre las
 * abiertas no está `PENDIENTE_DE_PAGO`. Las escrituras van de la más vieja a la más nueva: las
 * `SALDO_A_DESCONTAR` que absorbió (en cadena) como `DESCONTADA`, con el mes que las absorbió, y al
 * final la que se paga, `PAGADA`. Los ids y los datos de la transferencia los pone el repository.
 */
export function armarCierre(
  abiertas: readonly Liquidacion[],
  { profesorId, mes }: { profesorId: number; mes: string },
): CierreDeLiquidacion | null {
  const buscar = (m: string) => abiertas.find((l) => l.profesor.id === profesorId && l.mes === m)
  const liquidacion = buscar(mes)
  if (liquidacion?.estado !== 'PENDIENTE_DE_PAGO') return null

  const escrituras: EscrituraDeCierre[] = []
  const agregar = (
    actual: Liquidacion,
    estado: EscrituraDeCierre['estado'],
    descontadaEnMes: string | null,
  ) => {
    for (const ajuste of actual.ajustes) {
      if (ajuste.tipo !== 'SALDO_ANTERIOR') continue
      const origen = buscar(ajuste.mesOrigen)
      if (origen?.estado !== 'SALDO_A_DESCONTAR') {
        throw new Error(
          `armarCierre: falta la liquidación ${ajuste.mesOrigen} a descontar del profesor ${profesorId}`,
        )
      }
      agregar(origen, 'DESCONTADA', actual.mes)
    }
    escrituras.push(escrituraDe(actual, estado, descontadaEnMes))
  }
  agregar(liquidacion, 'PAGADA', null)
  return { liquidacion, escrituras }
}
