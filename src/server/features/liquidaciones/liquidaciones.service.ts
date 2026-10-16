import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { UltimoAdjunto } from '@/server/features/adjuntos/adjuntos.condiciones'
import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { fechaDocumento } from '@/server/shared/formato'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { mesAnterior, mesDe, minutosAHora, ultimoDiaDelMes } from '@/server/shared/zod'
import type { Liquidacion, ProfesorRef } from './liquidaciones.condiciones'
import type { LiquidacionesRepository } from './liquidaciones.repository'
import {
  MENSAJE_MES_FUTURO,
  MENSAJE_TRANSFERENCIA_FUTURA,
  mensajeMesNoTerminado,
  type FilaLiquidacion,
  type LiquidacionDetalle,
  type LiquidacionPagada,
  type LiquidacionesDelMes,
  type LiquidacionesQuery,
  type LiquidacionParams,
  type PagarLiquidacion,
  type TotalesLiquidacion,
} from './liquidaciones.validation'

// Liquidaciones del gerente (HU-44, T-124): el listado del mes, el detalle y el pago. No conoce HTTP ni
// Prisma: lanza AppError o sus subclases. No calcula importes: todo sale de la `Liquidacion` del
// motor (`liquidaciones.condiciones.ts`), que congela las cerradas (decisión T-156).

const aCentavos = (importe: number) => Math.round(importe * 100)

function totalesDe(liquidacion: Liquidacion): TotalesLiquidacion {
  return {
    cantidadTurnos: liquidacion.turnos.length,
    totalCobrado: liquidacion.totalCobrado,
    parteCentro: liquidacion.parteCentro,
    parteProfesor: liquidacion.parteProfesor,
    totalAjustes: liquidacion.totalAjustes,
    total: liquidacion.total,
  }
}

/** Suma de cada columna, en centavos enteros (convenciones-backend.md → Importes). */
function sumarTotales(filas: readonly TotalesLiquidacion[]): TotalesLiquidacion {
  const suma = (columna: keyof Omit<TotalesLiquidacion, 'cantidadTurnos'>) =>
    filas.reduce((total, fila) => total + aCentavos(fila[columna]), 0) / 100
  return {
    cantidadTurnos: filas.reduce((total, fila) => total + fila.cantidadTurnos, 0),
    totalCobrado: suma('totalCobrado'),
    parteCentro: suma('parteCentro'),
    parteProfesor: suma('parteProfesor'),
    totalAjustes: suma('totalAjustes'),
    total: suma('total'),
  }
}

function aFila(liquidacion: Liquidacion): FilaLiquidacion {
  return {
    profesor: liquidacion.profesor,
    estado: liquidacion.estado,
    ...totalesDe(liquidacion),
    fechaTransferencia:
      liquidacion.estado === 'PAGADA' ? (liquidacion.cerrada?.fechaTransferencia ?? null) : null,
    descontadaEnMes:
      liquidacion.estado === 'DESCONTADA' ? (liquidacion.cerrada?.descontadaEnMes ?? null) : null,
  }
}

function aRespuestaDetalle(
  liquidacion: Liquidacion,
  adjunto: UltimoAdjunto | null,
): LiquidacionDetalle {
  const { cerrada } = liquidacion
  return {
    profesor: liquidacion.profesor,
    mes: liquidacion.mes,
    estado: liquidacion.estado,
    turnos: liquidacion.turnos.map((turno) => ({
      fecha: turno.fecha,
      horaInicio: minutosAHora(turno.horaInicio),
      horaFin: minutosAHora(turno.horaFin),
      alumno: turno.alumno,
      materia: turno.materia,
      numeroComprobante: turno.numeroComprobante,
      importe: turno.importe,
      porcentaje: turno.porcentaje,
      parteProfesor: turno.parteProfesor,
    })),
    ajustes: liquidacion.ajustes.map(({ tipo, texto, importe }) => ({ tipo, texto, importe })),
    ...totalesDe(liquidacion),
    cerrada: cerrada && {
      liquidacionId: cerrada.id,
      fechaTransferencia: cerrada.fechaTransferencia,
      numeroOperacion: cerrada.numeroOperacion,
      observaciones: cerrada.observaciones,
      descontadaEnMes: cerrada.descontadaEnMes,
      comprobanteAdjunto: adjunto && {
        id: adjunto.id,
        nombre: adjunto.nombre,
        tipo: adjunto.tipo,
        bytes: adjunto.bytes,
        adjuntadoPor: adjunto.adjuntadoPor,
        adjuntadoEl: adjunto.adjuntadoEl,
      },
      registradaPor: cerrada.registradaPor,
      registradaEl: cerrada.registradaEl,
    },
    // El motor ya garantiza mes terminado y total > 0 en `PENDIENTE_DE_PAGO`.
    acciones: { registrarPago: liquidacion.estado === 'PENDIENTE_DE_PAGO' },
  }
}

/** La liquidación de un profesor sin movimientos en el mes. */
function detalleVacio(profesor: ProfesorRef, mes: string): LiquidacionDetalle {
  return {
    profesor,
    mes,
    estado: null,
    turnos: [],
    ajustes: [],
    ...sumarTotales([]),
    cerrada: null,
    acciones: { registrarPago: false },
  }
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Lo importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearLiquidacionesService({
  repository,
  reloj,
}: {
  repository: Pick<
    LiquidacionesRepository,
    'delMes' | 'deProfesor' | 'leerProfesor' | 'ultimoAdjunto' | 'pagar'
  >
  reloj?: Reloj
}) {
  /** 400 en `mes` si es posterior al mes de `fechaHoy`. El mes en curso se puede pedir. */
  function exigirMesNoFuturo(mes: string, fechaHoy: string): void {
    if (mes > mesDe(fechaHoy)) {
      throw new ValidationError('Datos de entrada inválidos', {
        details: [{ path: ['mes'], message: MENSAJE_MES_FUTURO }],
      })
    }
  }

  /** 400 en `fechaTransferencia` si es futura o anterior al último día del mes liquidado. */
  function exigirFechaTransferencia(fecha: string, mes: string, fechaHoy: string): void {
    const ultimoDia = ultimoDiaDelMes(mes)
    const mensaje =
      fecha > fechaHoy
        ? MENSAJE_TRANSFERENCIA_FUTURA
        : fecha < ultimoDia
          ? `La transferencia no puede ser anterior al ${fechaDocumento(ultimoDia)}`
          : null
    if (mensaje) {
      throw new ValidationError('Datos de entrada inválidos', {
        details: [{ path: ['fechaTransferencia'], message: mensaje }],
      })
    }
  }

  async function exigirProfesor(profesorId: number): Promise<ProfesorRef> {
    const profesor = await repository.leerProfesor(profesorId)
    if (!profesor) throw new NotFoundError('Profesor no encontrado')
    return profesor
  }

  return {
    /**
     * Las liquidaciones del mes (por defecto, el último terminado), una por profesor con
     * movimientos, paginadas en memoria; `totales` es de todo el listado.
     */
    async listar(query: LiquidacionesQuery): Promise<LiquidacionesDelMes> {
      const fechaHoy = hoy(reloj)
      const mes = query.mes ?? mesAnterior(mesDe(fechaHoy))
      exigirMesNoFuturo(mes, fechaHoy)
      const filas = (await repository.delMes({ mes, hoy: fechaHoy })).map(aFila)
      const { skip, take } = calcularSkipTake(query)
      return {
        mes,
        totales: sumarTotales(filas),
        data: filas.slice(skip, skip + take),
        meta: armarMeta(query, filas.length),
      }
    },

    /**
     * La liquidación de un profesor en un mes: la cerrada (congelada, con su comprobante) o la
     * abierta. Profesor inexistente → 404; sin movimientos → la liquidación vacía.
     */
    async detalle({ profesorId, mes }: LiquidacionParams): Promise<LiquidacionDetalle> {
      const fechaHoy = hoy(reloj)
      exigirMesNoFuturo(mes, fechaHoy)
      const [profesor, liquidacion] = await Promise.all([
        repository.leerProfesor(profesorId),
        repository.deProfesor({ profesorId, mes, hoy: fechaHoy }),
      ])
      if (!profesor) throw new NotFoundError('Profesor no encontrado')
      if (!liquidacion) return detalleVacio(profesor, mes)
      const adjunto =
        liquidacion.cerrada && liquidacion.estado === 'PAGADA'
          ? await repository.ultimoAdjunto(liquidacion.cerrada.id)
          : null
      return aRespuestaDetalle(liquidacion, adjunto)
    },

    /**
     * Registra la transferencia de una liquidación `PENDIENTE_DE_PAGO` por su total calculado. Orden
     * de errores: 404 del profesor; 409 si el mes no terminó; 400 de `fechaTransferencia`; después,
     * los 409 de la transacción (`pagar`: ya pagada, sin importe o total modificado).
     */
    async pagar(
      { profesorId, mes }: LiquidacionParams,
      datos: PagarLiquidacion,
      actor: Actor,
    ): Promise<LiquidacionPagada> {
      const fechaHoy = hoy(reloj)
      const profesor = await exigirProfesor(profesorId)
      if (mes >= mesDe(fechaHoy)) throw new ConflictError(mensajeMesNoTerminado(mes))
      exigirFechaTransferencia(datos.fechaTransferencia, mes, fechaHoy)
      const { liquidacionId, total } = await repository.pagar(
        {
          profesor,
          mes,
          hoy: fechaHoy,
          fechaTransferencia: datos.fechaTransferencia,
          numeroOperacion: datos.numeroOperacion,
          observaciones: datos.observaciones ?? null,
          comprobanteAdjuntoId: datos.comprobanteAdjuntoId ?? null,
          totalConfirmado: datos.totalConfirmado,
        },
        actor,
      )
      return { liquidacionId, profesor, mes, total, fechaTransferencia: datos.fechaTransferencia }
    },
  }
}

export type LiquidacionesService = ReturnType<typeof crearLiquidacionesService>
