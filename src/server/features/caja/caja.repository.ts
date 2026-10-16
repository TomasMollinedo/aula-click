import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/server/errors'
import { dateAFecha, fechaADate, fechaEnZona, sumarDias } from '@/server/shared/fechas'
import { mesDe } from '@/server/shared/zod'
import type {
  AnulacionLeida,
  CobroLeido,
  CodigoFormaPago,
  PagoProfesorLeido,
  TurnoCobrado,
} from './caja.reglas'

// Único lugar de la feature que usa Prisma. Sólo lecturas, una por tipo de movimiento, y sólo para
// el día pedido: la caja no tiene tablas propias ni escribe nada. No decide nada de negocio (el
// resumen, el orden y los filtros son de `caja.reglas.ts`). Los importes salen como `number`, nunca
// como `Prisma.Decimal`, y las fechas de calendario como `YYYY-MM-DD`.

/** Del más temprano al más tardío, con el `id` de desempate. */
const ORDEN_DE_REGISTRO = [{ createdAt: 'asc' }, { id: 'asc' }] as const

/** Lo que se necesita de un pago para el movimiento y para su reparto. */
const SELECT_PAGO = {
  id: true,
  numeroComprobante: true,
  importeTotal: true,
  estado: true,
  createdAt: true,
  alumno: { select: { id: true, nombre: true, apellido: true } },
  formaPago: { select: { tipoFormaPago: true, nombre: true } },
  // También los turnos de un pago anulado: siguen guardados y su reparto es el del cobro que se anula.
  turnos: { select: { importeAplicado: true, porcentajeCentro: true } },
} satisfies Prisma.PagoSelect

type FilaPago = Prisma.PagoGetPayload<{ select: typeof SELECT_PAGO }>

/** El código de la forma de pago de una fila; sin código es un error de configuración (falta el seed). */
function formaDe(forma: { tipoFormaPago: CodigoFormaPago | null; nombre: string }) {
  if (forma.tipoFormaPago === null) {
    throw new AppError('Hay una forma de pago sin código: corré `pnpm db:seed`', 500)
  }
  return { codigo: forma.tipoFormaPago, nombre: forma.nombre }
}

function turnosDe(fila: FilaPago): TurnoCobrado[] {
  return fila.turnos.map((t) => ({
    importe: t.importeAplicado.toNumber(),
    porcentaje: t.porcentajeCentro.toNumber(),
  }))
}

function aPagoLeido(fila: FilaPago) {
  return {
    pagoId: fila.id,
    numeroComprobante: fila.numeroComprobante,
    registradoEl: fila.createdAt.toISOString(),
    alumno: fila.alumno,
    formaPago: formaDe(fila.formaPago),
    importe: fila.importeTotal.toNumber(),
    turnos: turnosDe(fila),
  }
}

export const cajaRepository = {
  /**
   * Los pagos con fecha de pago igual a `fecha` (`YYYY-MM-DD`), vigentes y anulados: un pago que
   * se anuló después igual fue un cobro ese día. Por hora de registro. Una consulta.
   */
  async cobrosDelDia(fecha: string): Promise<CobroLeido[]> {
    const filas = await prisma.pago.findMany({
      where: { fechaPago: fechaADate(fecha) },
      select: SELECT_PAGO,
      orderBy: [...ORDEN_DE_REGISTRO],
    })
    return filas.map((fila) => ({ ...aPagoLeido(fila), estado: fila.estado }))
  },

  /**
   * Las anulaciones registradas en `fecha` (el día en la hora del negocio, no el del pago que
   * anulan), con ese pago. Por hora de registro. Una consulta: se pide un margen de un día a cada
   * lado y la fecha de Salta de cada anulación (`fechaEnZona`) decide cuáles son del día, así no se
   * repite acá cómo se arma el día de una zona horaria.
   */
  async anulacionesDelDia(fecha: string): Promise<AnulacionLeida[]> {
    const filas = await prisma.anulacionPago.findMany({
      where: {
        createdAt: { gte: fechaADate(sumarDias(fecha, -1)), lt: fechaADate(sumarDias(fecha, 2)) },
      },
      select: { motivo: true, detalle: true, createdAt: true, pago: { select: SELECT_PAGO } },
      orderBy: [...ORDEN_DE_REGISTRO],
    })
    return filas
      .filter((fila) => fechaEnZona(fila.createdAt) === fecha)
      .map((fila) => ({
        ...aPagoLeido(fila.pago),
        // La hora de la anulación, no la del pago.
        registradoEl: fila.createdAt.toISOString(),
        motivo: fila.motivo,
        detalle: fila.detalle,
      }))
  },

  /**
   * Las liquidaciones `PAGADA` con fecha de transferencia igual a `fecha`, por hora de registro.
   * Las `DESCONTADA` no son transferencias y no entran. Su forma de pago es la transferencia: una
   * consulta más, sólo si hay alguna.
   */
  async pagosAProfesoresDelDia(fecha: string): Promise<PagoProfesorLeido[]> {
    const filas = await prisma.liquidacion.findMany({
      where: { estado: 'PAGADA', fechaTransferencia: fechaADate(fecha) },
      select: {
        profesorId: true,
        mes: true,
        numeroOperacion: true,
        total: true,
        createdAt: true,
        profesor: { select: { usuario: { select: { nombre: true, apellido: true } } } },
      },
      orderBy: [...ORDEN_DE_REGISTRO],
    })
    if (filas.length === 0) return []

    const transferencia = await prisma.formaPago.findUnique({
      where: { tipoFormaPago: 'TRANSFERENCIA' },
      select: { nombre: true },
    })
    if (!transferencia) {
      throw new AppError('Falta la forma de pago TRANSFERENCIA: corré `pnpm db:seed`', 500)
    }
    return filas.map((fila) => ({
      profesor: {
        id: fila.profesorId,
        nombre: fila.profesor.usuario.nombre,
        apellido: fila.profesor.usuario.apellido,
      },
      mes: mesDe(dateAFecha(fila.mes)),
      numeroOperacion: fila.numeroOperacion,
      formaPago: { codigo: 'TRANSFERENCIA' as const, nombre: transferencia.nombre },
      importe: fila.total.toNumber(),
      registradoEl: fila.createdAt.toISOString(),
    }))
  },
}

export type CajaRepository = typeof cajaRepository
