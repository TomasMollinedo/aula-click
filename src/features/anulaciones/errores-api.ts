import type { ApiError } from '@/utils/fetch-json'

import { ANULACION_FORM_FIELDS, type CampoAnulacionForm } from './anulaciones.schema'

// Errores de la API de anulaciones (docs/contrato-api.md → Anulaciones y Errores) en lo que muestra
// el diálogo, tanto de la previa como del POST.

const MENSAJE_SIN_PERMISO = 'No tenés permiso para anular pagos'
const CAMPOS = new Set<string>(ANULACION_FORM_FIELDS)

export type ErrorAnulacion =
  /** 400 por campo (motivo, detalle). `mensaje`: lo que no es de un campo, o `null`. */
  | {
      tipo: 'campos'
      camposMarcados: { campo: CampoAnulacionForm; mensaje: string }[]
      mensaje: string | null
    }
  /**
   * `definitivo`: el pago no se puede anular y reintentar no cambia nada (no existe, otra persona ya
   * lo anuló —409 `PAGO_ANULADO`—, o no hay permiso). Si no, se puede reintentar.
   */
  | { tipo: 'general'; mensaje: string; definitivo: boolean }

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

/**
 * Convierte un ApiError de `GET /anulaciones/previa` o de `POST /anulaciones` en lo que muestra el
 * diálogo. Un 409 es siempre `PAGO_ANULADO`: se muestra con el mensaje de la API.
 */
export function interpretarErrorAnulacion(error: ApiError): ErrorAnulacion {
  if (error.status === 403) {
    return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO, definitivo: true }
  }

  if (error.status === 400 && error.code === 'VALIDACION') {
    const details = Array.isArray(error.details) ? (error.details as unknown[]) : []
    const camposMarcados: { campo: CampoAnulacionForm; mensaje: string }[] = []
    let mensaje: string | null = null
    for (const d of details) {
      if (!esRegistro(d) || typeof d.message !== 'string') continue
      const campo = Array.isArray(d.path) ? d.path[0] : null
      if (typeof campo === 'string' && CAMPOS.has(campo)) {
        camposMarcados.push({ campo: campo as CampoAnulacionForm, mensaje: d.message })
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
