import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError, ConflictError } from '@/server/errors'
import {
  bloquearAlumno,
  leerOcurrencias,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate, type Reloj } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import {
  CODIGO_TURNOS_NO_COBRABLES,
  MENSAJE_YA_PAGADO_CONCURRENTE,
  type PlanPago,
  type SnapshotPago,
} from './pagos.reglas'
import type { ComprobanteGuardado, EntradaPago, OcurrenciaPedida } from './pagos.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: qué se puede cobrar y cuánto lo
// decide `planificarPago` (`pagos.reglas.ts`), que el service pasa como callback `verificar`. Las
// ocurrencias salen del motor de `turnos` (`ocurrencias.condiciones.ts`), nunca de una expansión
// propia. Los importes salen como `number` (`toNumber()`), nunca como `Prisma.Decimal`.

/** Forma de pago de todos los cobros de este sprint (definición del catálogo en el seed). */
export const FORMA_PAGO_EFECTIVO = 'Efectivo'

const MENSAJE_SIN_EFECTIVO = `Falta la forma de pago "${FORMA_PAGO_EFECTIVO}" activa: corré \`pnpm db:seed\``

// Nombre del índice único de `PagoTurno (turnoId, fechaOcurrencia)` (migración de T-63).
const INDICE_PAGO_TURNO = 'pago_turno_turno_id_fecha_ocurrencia_key'

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
 * dos únicos posibles (`pago.numero_comprobante` y `pago_turno (turno_id, fecha_ocurrencia)`), así
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
  formaPago: { select: { id: true, nombre: true } },
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  turnos: {
    select: {
      turnoId: true,
      fechaOcurrencia: true,
      importeAplicado: true,
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
   * 2. Relee con el `tx` las ocurrencias pedidas, los precios vigentes y la forma de pago
   *    "Efectivo" activa (si falta, 500: es un error de configuración, falta el seed).
   * 3. `verificar(snapshot)`: si lanza, no se escribe nada.
   * 4. Crea el `Pago` (`VIGENTE` por defecto, auditoría del actor) con un `PagoTurno` por línea
   *    (`fechaOcurrencia` = la fecha de la ocurrencia, `importeAplicado` = el precio vigente).
   * 5. Una P2002 del único de `pago_turno` es la última red contra el pago doble: 409
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
        const formaPago = await tx.formaPago.findFirst({
          where: { nombre: FORMA_PAGO_EFECTIVO, estado: 'ACTIVO' },
          select: { id: true },
        })
        if (!formaPago) throw new AppError(MENSAJE_SIN_EFECTIVO, 500)

        const plan = verificar(snapshot)

        const pago = await tx.pago.create({
          data: {
            alumnoId: entrada.alumnoId,
            formaPagoId: formaPago.id,
            importeTotal: aDecimal(plan.total),
            fechaPago: fechaADate(entrada.fechaPago),
            montoRecibido: entrada.montoRecibido === null ? null : aDecimal(entrada.montoRecibido),
            observaciones: entrada.observaciones,
            createdById: actor.userId,
            updatedById: actor.userId,
            turnos: {
              create: plan.lineas.map((linea) => ({
                turnoId: linea.turnoId,
                fechaOcurrencia: fechaADate(linea.fecha),
                importeAplicado: aDecimal(linea.importe),
              })),
            },
          },
          select: { id: true, numeroComprobante: true },
        })
        return { pagoId: pago.id, numeroComprobante: pago.numeroComprobante, plan }
      }, TRANSACCION_PAGO)
    } catch (error) {
      traducirPagoDoble(error)
    }
  },

  /**
   * Datos del comprobante (sin el vuelto, que calcula el service), o `null` si no existe. Una sola
   * consulta. Los turnos llevan los datos **actuales** de su turno (fecha, horario, materia y
   * profesor; decisión T-63) y el importe cobrado (`importeAplicado`), ordenados por fecha, hora
   * de inicio y `turnoId`.
   */
  async buscarComprobante(id: number): Promise<ComprobanteGuardado | null> {
    const fila = await prisma.pago.findUnique({ where: { id }, select: SELECT_COMPROBANTE })
    if (!fila) return null
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
      formaPago: fila.formaPago,
      observaciones: fila.observaciones,
      registradoPor: {
        id: fila.createdBy.id,
        nombre: fila.createdBy.nombre,
        apellido: fila.createdBy.apellido,
      },
      registradoEl: fila.createdAt.toISOString(),
    }
  },
}

export type PagosRepository = typeof pagosRepository
