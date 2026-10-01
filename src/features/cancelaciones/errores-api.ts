import type { ApiError } from '@/utils/fetch-json'

import { CANCELACION_FORM_FIELDS, type CampoCancelacionForm } from './cancelaciones.schema'
import type { OcurrenciaACancelar } from './cancelaciones.types'
import { textoOcurrencia } from './formato-cancelaciones'

// Errores de la API de cancelaciones (docs/contrato-api.md → Cancelaciones y Errores) en lo que
// muestra la UI. Es el único lugar que conoce la forma de sus `details`.

export const CODIGO_TURNOS_NO_CANCELABLES = 'TURNOS_NO_CANCELABLES'

const MENSAJE_SIN_PERMISO = 'No tenés permiso para cancelar turnos'
const CAMPOS = new Set<string>(CANCELACION_FORM_FIELDS)

export type ErrorCancelacion =
  /** 409: `lineas` dice cuáles no se pudieron cancelar y por qué; no se canceló ninguna. */
  | { tipo: 'noCancelables'; mensaje: string; lineas: string[] }
  /** 400 por campo (motivo, detalle). `mensaje`: lo que no corresponde a un campo, o `null`. */
  | {
      tipo: 'campos'
      camposMarcados: { campo: CampoCancelacionForm; mensaje: string }[]
      mensaje: string | null
    }
  | { tipo: 'general'; mensaje: string }

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

/**
 * Convierte un ApiError de `POST /cancelaciones` en lo que muestra el diálogo. Cada detalle del 409
 * lleva `path: ['ocurrencias', posición]` y el `message` de la API ("El turno está pagado: no se
 * puede cancelar"): se lo muestra tal cual, junto a la ocurrencia que corresponde. Un `details`
 * sin esa forma cae al mensaje general.
 */
export function interpretarErrorCancelacion(
  error: ApiError,
  pedidas: readonly OcurrenciaACancelar[],
): ErrorCancelacion {
  if (error.status === 403) return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO }
  const details = Array.isArray(error.details) ? (error.details as unknown[]) : []

  if (error.status === 409 && error.code === CODIGO_TURNOS_NO_CANCELABLES) {
    const lineas = details.flatMap((d) => {
      if (!esRegistro(d) || typeof d.message !== 'string') return []
      const posicion = Array.isArray(d.path) && d.path[0] === 'ocurrencias' ? d.path[1] : null
      const ocurrencia = typeof posicion === 'number' ? pedidas[posicion] : undefined
      return [ocurrencia ? `${textoOcurrencia(ocurrencia)}: ${d.message}` : d.message]
    })
    return { tipo: 'noCancelables', mensaje: error.message, lineas }
  }

  if (error.status === 400 && error.code === 'VALIDACION') {
    const camposMarcados: { campo: CampoCancelacionForm; mensaje: string }[] = []
    let mensaje: string | null = null
    for (const d of details) {
      if (!esRegistro(d) || typeof d.message !== 'string') continue
      const campo = Array.isArray(d.path) ? d.path[0] : null
      if (typeof campo === 'string' && CAMPOS.has(campo)) {
        camposMarcados.push({ campo: campo as CampoCancelacionForm, mensaje: d.message })
      } else {
        mensaje ??= d.message
      }
    }
    if (camposMarcados.length === 0 && mensaje === null) mensaje = error.message
    return { tipo: 'campos', camposMarcados, mensaje }
  }

  return { tipo: 'general', mensaje: error.message }
}
