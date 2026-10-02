import type { ApiError } from '@/utils/fetch-json'

import { type CampoFinalizacionForm, FINALIZACION_FORM_FIELDS } from './finalizaciones.schema'
import type { TurnoPagado } from './finalizaciones.types'

// Errores de la API de finalizaciones (docs/contrato-api.md → Finalizaciones y Errores) en lo que
// muestra la UI, tanto de la previa como del POST. Es el único lugar que conoce la forma de sus
// `details`.

export const CODIGO_TURNOS_PAGADOS = 'TURNOS_PAGADOS'

const MENSAJE_SIN_PERMISO = 'No tenés permiso para finalizar turnos'
const CAMPOS = new Set<string>(FINALIZACION_FORM_FIELDS)

export type ErrorFinalizacion =
  /** 400 por campo (fechaDesde, motivo, detalle). `mensaje`: lo que no es de un campo, o `null`. */
  | {
      tipo: 'campos'
      camposMarcados: { campo: CampoFinalizacionForm; mensaje: string }[]
      mensaje: string | null
    }
  /** 409 `TURNOS_PAGADOS`: entró un pago entre la previa y la confirmación. No se finalizó. */
  | {
      tipo: 'pagados'
      ultimaFechaPagada: string
      /** `null`: los pagados llegan hasta el final de la serie y no queda fecha para elegir. */
      fechaDesdeMinima: string | null
      pagadas: TurnoPagado[]
    }
  /**
   * `definitivo`: el turno no se puede finalizar con ninguna fecha (no existe, es una sesión única,
   * ya no está vigente, ya fue finalizado, o no hay permiso). Si no, se puede reintentar.
   */
  | { tipo: 'general'; mensaje: string; definitivo: boolean }

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

function esTurnoPagado(valor: unknown): valor is TurnoPagado {
  return (
    esRegistro(valor) &&
    typeof valor.fecha === 'string' &&
    typeof valor.horaInicio === 'string' &&
    typeof valor.horaFin === 'string' &&
    typeof valor.importe === 'number'
  )
}

/**
 * Convierte un ApiError de `GET /finalizaciones/previa` o de `POST /finalizaciones` en lo que
 * muestra el diálogo. Los `details` de `TURNOS_PAGADOS` son un objeto (`ultimaFechaPagada`,
 * `fechaDesdeMinima`, `pagadas`); si no tienen esa forma, cae al mensaje general de la API.
 */
export function interpretarErrorFinalizacion(error: ApiError): ErrorFinalizacion {
  if (error.status === 403) {
    return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO, definitivo: true }
  }

  if (error.status === 409 && error.code === CODIGO_TURNOS_PAGADOS) {
    const d = error.details
    if (
      esRegistro(d) &&
      typeof d.ultimaFechaPagada === 'string' &&
      (typeof d.fechaDesdeMinima === 'string' || d.fechaDesdeMinima === null) &&
      Array.isArray(d.pagadas) &&
      d.pagadas.every(esTurnoPagado)
    ) {
      return {
        tipo: 'pagados',
        ultimaFechaPagada: d.ultimaFechaPagada,
        fechaDesdeMinima: d.fechaDesdeMinima,
        pagadas: d.pagadas,
      }
    }
    // Sin la forma esperada no se sabe qué fecha proponer: se puede elegir otra y volver a probar.
    return { tipo: 'general', mensaje: error.message, definitivo: false }
  }

  if (error.status === 400 && error.code === 'VALIDACION') {
    const details = Array.isArray(error.details) ? (error.details as unknown[]) : []
    const camposMarcados: { campo: CampoFinalizacionForm; mensaje: string }[] = []
    let mensaje: string | null = null
    for (const d of details) {
      if (!esRegistro(d) || typeof d.message !== 'string') continue
      const campo = Array.isArray(d.path) ? d.path[0] : null
      if (typeof campo === 'string' && CAMPOS.has(campo)) {
        camposMarcados.push({ campo: campo as CampoFinalizacionForm, mensaje: d.message })
      } else {
        mensaje ??= d.message
      }
    }
    if (camposMarcados.length === 0 && mensaje === null) mensaje = error.message
    return { tipo: 'campos', camposMarcados, mensaje }
  }

  return {
    tipo: 'general',
    mensaje: error.message,
    definitivo: error.status === 404 || error.status === 409,
  }
}
