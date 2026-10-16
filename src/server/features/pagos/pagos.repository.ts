import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import { ultimoAdjunto, vincularAdjunto } from '@/server/features/adjuntos/adjuntos.condiciones'
import {
  asistenciasDeOcurrencias,
  type OcurrenciaConsultada,
} from '@/server/features/asistencias/asistencias.condiciones'
import { porcentajeVigente } from '@/server/features/reparto/reparto.condiciones'
import {
  bloquearAlumno,
  leerOcurrencias,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate, type Reloj } from '@/server/shared/fechas'
import {
  armarMeta,
  calcularSkipTake,
  type MetaPaginacion,
  type PaginacionQuery,
} from '@/server/shared/paginacion'
import { minutosAHora } from '@/server/shared/zod'
import {
  pagosDelFiltro,
  totalAnuladoDelFiltro,
  totalCobradoPorForma,
  type FiltroPagos,
  type TotalesPorForma,
} from './pagos.condiciones'
import {
  agruparPorMateria,
  CODIGO_TURNOS_NO_COBRABLES,
  errorFormasDePago,
  MENSAJE_YA_PAGADO_CONCURRENTE,
  type PlanPago,
  type SnapshotPago,
} from './pagos.reglas'
import type {
  AdjuntoDelPago,
  AlumnoDePagos,
  BusquedaAcotadaDePagos,
  BusquedaDePagos,
  ComprobanteGuardado,
  EntradaPago,
  MateriaDePagos,
  MedioPago,
  MiPago,
  OcurrenciaPedida,
  PagoRealizado,
  ProfesorDePagos,
} from './pagos.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: qué se puede cobrar y cuánto lo
// decide `planificarPago` (`pagos.reglas.ts`), que el service pasa como callback `verificar`. Las
// ocurrencias salen del motor de `turnos` (`ocurrencias.condiciones.ts`), nunca de una expansión
// propia. Los importes salen como `number` (`toNumber()`), nunca como `Prisma.Decimal`.

/**
 * Las columnas del medio en `Pago` (HU-23): las del medio elegido con sus datos y las de los otros
 * en `null` (un pago, un medio). Nunca el número completo de la tarjeta: a lo sumo los últimos 4.
 */
function columnasDelMedio(medio: MedioPago) {
  const transferencia = medio.formaPago === 'TRANSFERENCIA' ? medio.transferencia : null
  const debito = medio.formaPago === 'DEBITO' ? medio.debito : null
  return {
    montoRecibido: medio.formaPago === 'EFECTIVO' ? aDecimal(medio.montoRecibido) : null,
    transferenciaOperacion: transferencia?.operacion ?? null,
    transferenciaBanco: transferencia?.banco ?? null,
    transferenciaTitular: transferencia?.titular ?? null,
    debitoRed: debito?.red ?? null,
    debitoCupon: debito?.cupon ?? null,
    debitoUltimos4: debito?.ultimos4 ?? null,
  }
}

// Nombre del índice único de `PagoTurno (turnoId, fechaOcurrencia, vigente)` (migración de T-70).
const INDICE_PAGO_TURNO = 'pago_turno_turno_id_fecha_ocurrencia_vigente_key'

/**
 * Timeout más largo que el default de Prisma (5 s): con pagos o cancelaciones simultáneas del
 * mismo alumno, la espera del lock cuenta dentro de la transacción (igual que la reserva).
 */
const TRANSACCION_PAGO = { timeout: 10_000 } as const

/**
 * Snapshot del cobro: **una** llamada a `leerOcurrencias` con los `turnoIds` pedidos y el rango de
 * sus fechas, sin `alumnoId` (así se distingue "de otro alumno" de "no existe"), y el precio por
 * hora vigente de sus materias en una consulta (`Ocurrencia` no trae el precio).
 */
async function leerSnapshot(
  client: ClienteOcurrencias,
  pedidas: readonly OcurrenciaPedida[],
  reloj?: Reloj,
): Promise<SnapshotPago> {
  const fechas = pedidas.map((o) => o.fecha).sort()
  const ocurrencias =
    fechas.length === 0
      ? []
      : await leerOcurrencias(
          client,
          {
            desde: fechas[0] as string,
            hasta: fechas.at(-1) as string,
            turnoIds: [...new Set(pedidas.map((o) => o.turnoId))],
          },
          reloj,
        )
  const materiaIds = [...new Set(ocurrencias.map((o) => o.materiaId))]
  const materias =
    materiaIds.length === 0
      ? []
      : await client.materia.findMany({
          where: { id: { in: materiaIds } },
          select: { id: true, precioHora: true },
        })
  return {
    ocurrencias,
    precios: new Map(materias.map((m) => [m.id, m.precioHora ? m.precioHora.toNumber() : null])),
  }
}

/**
 * Con Prisma 7 + `@prisma/adapter-pg`, un P2002 trae la restricción en
 * `meta.driverAdapterError.cause.constraint`: `{ index }` o `{ fields }`. En esta transacción hay
 * dos únicos posibles (`pago.numero_comprobante` y `pago_turno (turno_id, fecha_ocurrencia, vigente)`), así
 * que una forma que no se puede leer **no** se asume del pago doble.
 */
function esPagoDoble(meta: Record<string, unknown> | undefined): boolean {
  const causa = (meta?.driverAdapterError as { cause?: { constraint?: unknown } } | undefined)
    ?.cause
  const restriccion = causa?.constraint as { index?: unknown; fields?: unknown } | undefined
  if (typeof restriccion?.index === 'string') return restriccion.index === INDICE_PAGO_TURNO
  if (Array.isArray(restriccion?.fields)) {
    return restriccion.fields.some((f) => f === 'fecha_ocurrencia' || f === 'fechaOcurrencia')
  }
  return false
}

/** P2002 del único de `pago_turno` → 409 `TURNOS_NO_COBRABLES` sin `details`; el resto, igual. */
function traducirPagoDoble(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    esPagoDoble(error.meta)
  ) {
    throw new ConflictError(MENSAJE_YA_PAGADO_CONCURRENTE, {
      code: CODIGO_TURNOS_NO_COBRABLES,
      cause: error,
    })
  }
  throw error
}

/** Importe `number` → texto con dos decimales para el `Decimal` (no pasa por un float de la base). */
const aDecimal = (importe: number) => importe.toFixed(2)

const SELECT_COMPROBANTE = {
  id: true,
  numeroComprobante: true,
  fechaPago: true,
  importeTotal: true,
  montoRecibido: true,
  observaciones: true,
  createdAt: true,
  alumno: { select: { id: true, nombre: true, apellido: true, dni: true } },
  formaPago: { select: { tipoFormaPago: true, nombre: true } },
  transferenciaOperacion: true,
  transferenciaBanco: true,
  transferenciaTitular: true,
  debitoRed: true,
  debitoCupon: true,
  debitoUltimos4: true,
  estado: true,
  anulacion: {
    select: {
      motivo: true,
      detalle: true,
      createdAt: true,
      createdBy: { select: SELECT_USUARIO_AUDITORIA },
    },
  },
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  turnos: {
    select: {
      turnoId: true,
      fechaOcurrencia: true,
      importeAplicado: true,
      porcentajeCentro: true,
      turno: {
        select: {
          materia: { select: { id: true, nombre: true } },
          bloqueAgenda: {
            select: {
              horaInicio: true,
              horaFin: true,
              profesor: {
                select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PagoSelect

/**
 * Lo que muestra un pago en "Mis pagos" (HU-37): sin quién lo registró, el alumno, las
 * observaciones ni la anulación, que ni se leen.
 */
const SELECT_MI_PAGO = {
  id: true,
  numeroComprobante: true,
  fechaPago: true,
  importeTotal: true,
  estado: true,
  formaPago: { select: { tipoFormaPago: true, nombre: true } },
  turnos: { select: { turno: { select: { materia: { select: { id: true, nombre: true } } } } } },
} satisfies Prisma.PagoSelect

/** Un pago de los pagos realizados (HU-36): lo de "Mis pagos" más el alumno, la auditoría y la anulación. */
const SELECT_PAGO_REALIZADO = {
  ...SELECT_MI_PAGO,
  alumno: { select: { id: true, nombre: true, apellido: true } },
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  anulacion: { select: { motivo: true, detalle: true } },
} satisfies Prisma.PagoSelect

/** Del más reciente al más antiguo, con el `id` de desempate (convenciones-backend.md → Paginación). */
const ORDEN_PAGOS = [
  { fechaPago: 'desc' },
  { id: 'desc' },
] as const satisfies Prisma.PagoOrderByWithRelationInput[]

/**
 * Un pago listado: las materias distintas de sus turnos, por nombre (con `agruparPorMateria`, el
 * mismo orden que el comprobante), y la cantidad de turnos. Es la base de `aPagoRealizado`.
 */
function aMiPago(fila: Prisma.PagoGetPayload<{ select: typeof SELECT_MI_PAGO }>): MiPago {
  const codigo = fila.formaPago.tipoFormaPago
  if (codigo === null) throw errorFormasDePago()
  const materias = agruparPorMateria(
    fila.turnos.map((pt) => ({ materia: pt.turno.materia, importe: null })),
  ).map((grupo) => grupo.materia)
  return {
    id: fila.id,
    numeroComprobante: fila.numeroComprobante,
    fechaPago: dateAFecha(fila.fechaPago),
    materias,
    cantidad: fila.turnos.length,
    total: fila.importeTotal.toNumber(),
    formaPago: { codigo, nombre: fila.formaPago.nombre },
    estado: fila.estado,
  }
}

function aPagoRealizado(
  fila: Prisma.PagoGetPayload<{ select: typeof SELECT_PAGO_REALIZADO }>,
): PagoRealizado {
  return {
    ...aMiPago(fila),
    alumno: fila.alumno,
    registradoPor: {
      id: fila.createdBy.id,
      nombre: fila.createdBy.nombre,
      apellido: fila.createdBy.apellido,
    },
    anulacion: fila.anulacion && { motivo: fila.anulacion.motivo, detalle: fila.anulacion.detalle },
  }
}

/** Máximo de opciones de un buscador de los filtros de pagos realizados (sin paginar). */
export const LIMITE_BUSCADOR = 20

/** Un `contains` sobre `busqueda` por cada término, combinados con AND (`shared/busqueda.ts`). */
const porTerminos = (terminos: string[]) => terminos.map((t) => ({ busqueda: { contains: t } }))

/**
 * Un turno "incluido en un pago" de los buscadores de profesores y materias: algún `PagoTurno` y,
 * con `alumnoId`, de un pago de ese alumno (decisión T-170).
 */
const turnoPagado = (alumnoId: number | undefined) => ({
  pagoTurnos: { some: alumnoId !== undefined ? { pago: { alumnoId } } : {} },
})

export const pagosRepository = {
  /**
   * Snapshot para el chequeo previo del service, **sin lock**: sólo sirve para dar errores claros
   * y en orden. La decisión que vale es la de `registrar`, con lo releído bajo lock.
   */
  async leerSnapshot(pedidas: readonly OcurrenciaPedida[], reloj?: Reloj): Promise<SnapshotPago> {
    return leerSnapshot(prisma, pedidas, reloj)
  },

  /**
   * Registra un pago de forma atómica, todo o nada, en una sola transacción:
   * 1. `bloquearAlumno` (`alumno` `FOR UPDATE`), **antes de cualquier lectura**: serializa con
   *    otro pago, la cancelación, la finalización y la reprogramación de ese alumno (decisión
   *    T-59).
   * 2. Relee con el `tx` las ocurrencias pedidas, los precios vigentes y la forma de pago activa
   *    por su código (`tipoFormaPago`; si falta, 500: es un error de configuración, falta el seed).
   * 3. `verificar(snapshot)`: si lanza, no se escribe nada.
   * 4. Lee una vez el porcentaje del centro vigente (`porcentajeVigente`, de `reparto`): todos los
   *    turnos del pago guardan el mismo. Sin `PorcentajeCentro` lanza y la transacción se deshace
   *    (500, decisión T-161).
   * 5. Crea el `Pago` (`VIGENTE` por defecto, auditoría del actor) con los datos de su medio
   *    (`columnasDelMedio`) y un `PagoTurno` por línea (`fechaOcurrencia` = la fecha de la
   *    ocurrencia, `importeAplicado` = el precio vigente, `porcentajeCentro` = el leído en 4).
   * 6. Con comprobante adjunto, lo vincula al pago (`vincularAdjunto`, de `adjuntos`): si no es
   *    un adjunto disponible de quien cobra, 400 `ADJUNTO_INVALIDO` y la transacción se deshace.
   * 7. Una P2002 del único de `pago_turno` es la última red contra el pago doble: 409
   *    `TURNOS_NO_COBRABLES` sin detalle por ocurrencia (la transacción ya se abortó).
   *
   * Devuelve el id, el número de comprobante y el plan con el que se registró (el decidido bajo
   * lock, que es el que se cobró).
   */
  async registrar(
    entrada: EntradaPago,
    verificar: (snapshot: SnapshotPago) => PlanPago,
    actor: Actor,
    reloj?: Reloj,
  ): Promise<{ pagoId: number; numeroComprobante: number; plan: PlanPago }> {
    try {
      return await prisma.$transaction(async (tx) => {
        await bloquearAlumno(tx, entrada.alumnoId)

        const snapshot = await leerSnapshot(tx, entrada.ocurrencias, reloj)
        const { medio } = entrada
        const formaPago = await tx.formaPago.findFirst({
          where: { tipoFormaPago: medio.formaPago, estado: 'ACTIVO' },
          select: { id: true },
        })
        if (!formaPago) throw errorFormasDePago(medio.formaPago)

        const plan = verificar(snapshot)
        const porcentaje = await porcentajeVigente(tx)

        const pago = await tx.pago.create({
          data: {
            alumnoId: entrada.alumnoId,
            formaPagoId: formaPago.id,
            importeTotal: aDecimal(plan.total),
            fechaPago: fechaADate(entrada.fechaPago),
            ...columnasDelMedio(medio),
            observaciones: entrada.observaciones,
            createdById: actor.userId,
            updatedById: actor.userId,
            turnos: {
              create: plan.lineas.map((linea) => ({
                turnoId: linea.turnoId,
                fechaOcurrencia: fechaADate(linea.fecha),
                importeAplicado: aDecimal(linea.importe),
                porcentajeCentro: String(porcentaje),
              })),
            },
          },
          select: { id: true, numeroComprobante: true },
        })
        if (medio.formaPago !== 'EFECTIVO' && medio.comprobanteAdjuntoId !== null) {
          await vincularAdjunto(tx, {
            adjuntoId: medio.comprobanteAdjuntoId,
            pagoId: pago.id,
            actor,
          })
        }
        return { pagoId: pago.id, numeroComprobante: pago.numeroComprobante, plan }
      }, TRANSACCION_PAGO)
    } catch (error) {
      traducirPagoDoble(error)
    }
  },

  /**
   * Datos del comprobante (sin el vuelto, que calcula el service), o `null` si no existe. Una sola
   * consulta, con la forma de pago por su código, los datos de su medio, el estado y, si está
   * anulado, la anulación (se lee junto con el pago, decisión T-120). Los turnos llevan los datos
   * **actuales** de su turno (fecha, horario, materia y profesor; decisión T-63) y el importe
   * cobrado (`importeAplicado`) con el porcentaje del centro que guardó el cobro, ordenados por fecha, hora de inicio y `turnoId`.
   */
  async buscarComprobante(id: number): Promise<ComprobanteGuardado | null> {
    const fila = await prisma.pago.findUnique({ where: { id }, select: SELECT_COMPROBANTE })
    if (!fila) return null
    const codigo = fila.formaPago.tipoFormaPago
    if (codigo === null) throw errorFormasDePago()
    const turnos = fila.turnos
      .map((pt) => ({
        turnoId: pt.turnoId,
        fecha: dateAFecha(pt.fechaOcurrencia),
        horaInicio: minutosAHora(pt.turno.bloqueAgenda.horaInicio),
        horaFin: minutosAHora(pt.turno.bloqueAgenda.horaFin),
        materia: { id: pt.turno.materia.id, nombre: pt.turno.materia.nombre },
        profesor: {
          id: pt.turno.bloqueAgenda.profesor.id,
          nombre: pt.turno.bloqueAgenda.profesor.usuario.nombre,
          apellido: pt.turno.bloqueAgenda.profesor.usuario.apellido,
        },
        importe: pt.importeAplicado.toNumber(),
        porcentaje: pt.porcentajeCentro.toNumber(),
      }))
      // `HH:mm` con ceros a la izquierda: el orden de texto es el de la hora.
      .sort(
        (a, b) =>
          a.fecha.localeCompare(b.fecha) ||
          a.horaInicio.localeCompare(b.horaInicio) ||
          a.turnoId - b.turnoId,
      )
    return {
      id: fila.id,
      numeroComprobante: fila.numeroComprobante,
      fechaPago: dateAFecha(fila.fechaPago),
      alumno: fila.alumno,
      turnos,
      total: fila.importeTotal.toNumber(),
      montoRecibido: fila.montoRecibido ? fila.montoRecibido.toNumber() : null,
      formaPago: { codigo, nombre: fila.formaPago.nombre },
      transferencia:
        codigo === 'TRANSFERENCIA'
          ? {
              operacion: fila.transferenciaOperacion ?? '',
              banco: fila.transferenciaBanco ?? '',
              titular: fila.transferenciaTitular,
            }
          : null,
      debito:
        codigo === 'DEBITO' && fila.debitoRed !== null
          ? { red: fila.debitoRed, cupon: fila.debitoCupon ?? '', ultimos4: fila.debitoUltimos4 }
          : null,
      estado: fila.estado,
      anulacion: fila.anulacion && {
        motivo: fila.anulacion.motivo,
        detalle: fila.anulacion.detalle,
        anuladoPor: {
          id: fila.anulacion.createdBy.id,
          nombre: fila.anulacion.createdBy.nombre,
          apellido: fila.anulacion.createdBy.apellido,
        },
        anuladoEl: fila.anulacion.createdAt.toISOString(),
      },
      observaciones: fila.observaciones,
      registradoPor: {
        id: fila.createdBy.id,
        nombre: fila.createdBy.nombre,
        apellido: fila.createdBy.apellido,
      },
      registradoEl: fila.createdAt.toISOString(),
    }
  },

  /**
   * Pagos realizados del filtro (HU-36), con su estado (`pagosDelFiltro`; con `TODOS`, vigentes y
   * anulados), del más reciente al más antiguo y paginados, con lo cobrado por forma de **todo** el
   * filtro, sin los anulados (`totalCobradoPorForma`, la misma definición que el tablero), y lo
   * anulado (`totalAnuladoDelFiltro`). Cantidad fija de consultas: la página y el `count` en una
   * transacción, la suma por forma y el código de las formas, y la suma de lo anulado.
   */
  async listarRealizados(
    filtro: FiltroPagos,
    paginacion: PaginacionQuery,
  ): Promise<{
    data: PagoRealizado[]
    meta: MetaPaginacion
    porForma: TotalesPorForma
    anulado: number
  }> {
    const where = pagosDelFiltro(filtro)
    const [[filas, total], porForma, anulado] = await Promise.all([
      prisma.$transaction([
        prisma.pago.findMany({
          where,
          select: SELECT_PAGO_REALIZADO,
          orderBy: [...ORDEN_PAGOS],
          ...calcularSkipTake(paginacion),
        }),
        prisma.pago.count({ where }),
      ]),
      totalCobradoPorForma(prisma, filtro),
      totalAnuladoDelFiltro(prisma, filtro),
    ])
    return {
      data: filas.map(aPagoRealizado),
      meta: armarMeta(paginacion, total),
      porForma,
      anulado,
    }
  },

  /**
   * Los pagos del alumno (HU-37), vigentes y anulados, con el mismo orden que `listarRealizados`
   * y paginados. No lee quién lo registró, el alumno, las observaciones ni la anulación.
   */
  async listarDelAlumno(
    alumnoId: number,
    paginacion: PaginacionQuery,
  ): Promise<{ data: MiPago[]; meta: MetaPaginacion }> {
    const where = { alumnoId }
    const [filas, total] = await prisma.$transaction([
      prisma.pago.findMany({
        where,
        select: SELECT_MI_PAGO,
        orderBy: [...ORDEN_PAGOS],
        ...calcularSkipTake(paginacion),
      }),
      prisma.pago.count({ where }),
    ])
    return { data: filas.map(aMiPago), meta: armarMeta(paginacion, total) }
  },

  /**
   * Buscador de alumnos del filtro de pagos realizados (HU-36, T-100): los que tienen al menos un
   * pago, vigente o anulado, cuya `busqueda` (apellido, nombre y DNI) contiene **todos** los
   * `terminos`, y con `id`, sólo ese. Por apellido y nombre (`busqueda`) e `id`, hasta
   * `LIMITE_BUSCADOR`. Sólo lee id, nombre y apellido: ni el DNI ni la foto. Una consulta.
   */
  async buscarAlumnos({ terminos, id }: BusquedaDePagos): Promise<AlumnoDePagos[]> {
    return prisma.alumno.findMany({
      where: {
        AND: [
          { pagos: { some: {} } },
          ...porTerminos(terminos),
          ...(id !== undefined ? [{ id }] : []),
        ],
      },
      select: { id: true, nombre: true, apellido: true },
      orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
      take: LIMITE_BUSCADOR,
    })
  },

  /**
   * Buscador de profesores del filtro de pagos realizados (HU-36, T-100): los que dictan algún
   * turno incluido en un pago (`PagoTurno` → `Turno` → `BloqueAgenda` → `Profesor`, el camino del
   * filtro `profesorId` de `pagosDelFiltro`), incluidos los dados de baja, con la búsqueda sobre su
   * `Usuario` y, con `id`, sólo ese; con `alumnoId`, sólo por los pagos de ese alumno (T-170).
   * Mismo orden y límite que `buscarAlumnos`. Una consulta.
   */
  async buscarProfesores({
    terminos,
    id,
    alumnoId,
  }: BusquedaAcotadaDePagos): Promise<ProfesorDePagos[]> {
    const filas = await prisma.profesor.findMany({
      where: {
        bloques: { some: { turnos: { some: turnoPagado(alumnoId) } } },
        usuario: { AND: porTerminos(terminos) },
        ...(id !== undefined ? { id } : {}),
      },
      select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
      orderBy: [{ usuario: { busqueda: 'asc' } }, { id: 'asc' }],
      take: LIMITE_BUSCADOR,
    })
    return filas.map((p) => ({ id: p.id, nombre: p.usuario.nombre, apellido: p.usuario.apellido }))
  },

  /**
   * Buscador de materias del filtro de pagos realizados (T-170): las de algún turno incluido en un
   * pago (`PagoTurno` → `Turno` → `Materia`, el camino del filtro `materiaId`) y, con `alumnoId`,
   * de un pago de ese alumno; incluidas las dadas de baja. La búsqueda va sobre su `busqueda` (el
   * nombre normalizado) y, con `id`, sólo esa. Por nombre, hasta `LIMITE_BUSCADOR`. Sólo lee id y
   * nombre. Una consulta.
   */
  async buscarMaterias({
    terminos,
    id,
    alumnoId,
  }: BusquedaAcotadaDePagos): Promise<MateriaDePagos[]> {
    return prisma.materia.findMany({
      where: {
        AND: [
          { turnos: { some: turnoPagado(alumnoId) } },
          ...porTerminos(terminos),
          ...(id !== undefined ? [{ id }] : []),
        ],
      },
      select: { id: true, nombre: true },
      orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
      take: LIMITE_BUSCADOR,
    })
  },

  /**
   * El último comprobante adjunto activo del pago (`ultimoAdjunto`, de `adjuntos`), sin la clave
   * del archivo: la URL la da `GET /adjuntos/pagos/{pagoId}`. `null` si no tiene. Una consulta.
   */
  async buscarAdjunto(pagoId: number): Promise<AdjuntoDelPago | null> {
    const adjunto = await ultimoAdjunto(prisma, pagoId)
    return (
      adjunto && {
        id: adjunto.id,
        nombre: adjunto.nombre,
        tipo: adjunto.tipo,
        bytes: adjunto.bytes,
        adjuntadoPor: adjunto.adjuntadoPor,
        adjuntadoEl: adjunto.adjuntadoEl,
      }
    )
  },

  /**
   * Si alguna de las ocurrencias (las de un pago) ya tiene asistencia `PRESENTE` o `AUSENTE`
   * (`asistenciasDeOcurrencias`, de `asistencias`): un pago así no se anula (decisión T-179). Una
   * consulta; ninguna si no hay ocurrencias.
   */
  async tieneTurnosDictados(ocurrencias: readonly OcurrenciaConsultada[]): Promise<boolean> {
    return (await asistenciasDeOcurrencias(prisma, ocurrencias)).length > 0
  },
}

export type PagosRepository = typeof pagosRepository
