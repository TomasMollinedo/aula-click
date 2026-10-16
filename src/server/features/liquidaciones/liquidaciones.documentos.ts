import { minutosAHora } from '@/server/shared/zod'
import type { EstadoLiquidacion, Liquidacion, ProfesorRef } from './liquidaciones.condiciones'

// Lo propio del documento PDF de una liquidación (T-125, HU-44 y HU-45) que no es dibujo: la forma
// de lo que el service le pasa a la plantilla y el nombre del archivo (docs/contrato-api.md →
// Documentos PDF). `respuestaPdf` lo sanea (tildes, espacios, mayúsculas). Funciones puras: no leen
// la base ni el reloj. Los importes son los del motor (`liquidaciones.condiciones.ts`): acá no se
// calcula nada.

/** Un turno del documento: el del detalle, con el horario en `HH:mm`. */
export type TurnoDelDocumento = {
  fecha: string
  horaInicio: string
  horaFin: string
  alumno: { nombre: string; apellido: string }
  materia: string
  /** El número de comprobante del cobro; `null` en el documento del profesor (decisión T-171). */
  numeroComprobante: number | null
  importe: number
  porcentaje: number
  parteProfesor: number
}

/** Lo que va en el PDF de la liquidación de un profesor en un mes. */
export type LiquidacionDocumento = {
  profesor: ProfesorRef
  mes: string
  /** `null` si el profesor no tiene movimientos en el mes. */
  estado: EstadoLiquidacion | null
  /** Con la columna del comprobante (el gerente) o sin ella (el profesor, decisión T-171). */
  conComprobante: boolean
  turnos: TurnoDelDocumento[]
  ajustes: { texto: string; importe: number }[]
  totalCobrado: number
  parteCentro: number
  parteProfesor: number
  totalAjustes: number
  total: number
  /** Sólo en una `PAGADA`: la transferencia (sin el comprobante adjunto). */
  transferencia: { fecha: string; numeroOperacion: string | null } | null
  /** Sólo en una `DESCONTADA`: el mes que absorbió su saldo. */
  descontadaEnMes: string | null
}

/**
 * El documento de la liquidación del motor (o la vacía, sin movimientos), con o sin el número de
 * comprobante. No lleva las observaciones del pago, quién lo registró ni el comprobante adjunto.
 */
export function documentoDeLiquidacion(
  profesor: ProfesorRef,
  mes: string,
  liquidacion: Liquidacion | null,
  { conComprobante }: { conComprobante: boolean },
): LiquidacionDocumento {
  if (!liquidacion) {
    return {
      profesor,
      mes,
      estado: null,
      conComprobante,
      turnos: [],
      ajustes: [],
      totalCobrado: 0,
      parteCentro: 0,
      parteProfesor: 0,
      totalAjustes: 0,
      total: 0,
      transferencia: null,
      descontadaEnMes: null,
    }
  }
  const { cerrada } = liquidacion
  return {
    profesor,
    mes,
    estado: liquidacion.estado,
    conComprobante,
    turnos: liquidacion.turnos.map((turno) => ({
      fecha: turno.fecha,
      horaInicio: minutosAHora(turno.horaInicio),
      horaFin: minutosAHora(turno.horaFin),
      alumno: { nombre: turno.alumno.nombre, apellido: turno.alumno.apellido },
      materia: turno.materia.nombre,
      numeroComprobante: conComprobante ? turno.numeroComprobante : null,
      importe: turno.importe,
      porcentaje: turno.porcentaje,
      parteProfesor: turno.parteProfesor,
    })),
    ajustes: liquidacion.ajustes.map(({ texto, importe }) => ({ texto, importe })),
    totalCobrado: liquidacion.totalCobrado,
    parteCentro: liquidacion.parteCentro,
    parteProfesor: liquidacion.parteProfesor,
    totalAjustes: liquidacion.totalAjustes,
    total: liquidacion.total,
    transferencia:
      liquidacion.estado === 'PAGADA' && cerrada?.fechaTransferencia
        ? { fecha: cerrada.fechaTransferencia, numeroOperacion: cerrada.numeroOperacion }
        : null,
    descontadaEnMes:
      liquidacion.estado === 'DESCONTADA' ? (cerrada?.descontadaEnMes ?? null) : null,
  }
}

/**
 * `liquidacion-gomez-ana-2026-09` (sin extensión): "liquidacion", el profesor y el mes, con guiones
 * entre las partes como el historial (decisión T-162; el `_` de T-123 es sólo para un rango).
 */
export function nombreArchivoLiquidacion(
  documento: Pick<LiquidacionDocumento, 'profesor' | 'mes'>,
): string {
  const { profesor, mes } = documento
  return `liquidacion-${profesor.apellido}-${profesor.nombre}-${mes}`
}
