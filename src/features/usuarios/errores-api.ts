import type { ApiError } from '@/utils/fetch-json'

import { CAMPOS_CONTRASENA, type CampoContrasena } from './usuarios.schema'

// Errores del cambio de contraseña (docs/contrato-api.md → Usuarios) en lo que muestra el
// formulario: cada 400 de la API en su campo (`details[].path[0]`); lo demás, como mensaje general.

const CAMPOS = new Set<string>(CAMPOS_CONTRASENA)

export type ErrorContrasena = {
  campos: { campo: CampoContrasena; mensaje: string }[]
  mensaje: string | null
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

export function interpretarErrorContrasena(error: ApiError): ErrorContrasena {
  if (error.status === 403) {
    return { campos: [], mensaje: 'No tenés permiso para cambiar la contraseña' }
  }
  if (error.status !== 400) return { campos: [], mensaje: error.message }

  const details = Array.isArray(error.details) ? (error.details as unknown[]) : []
  const campos: ErrorContrasena['campos'] = []
  let mensaje: string | null = null
  for (const d of details) {
    if (!esRegistro(d) || typeof d.message !== 'string') continue
    const campo = Array.isArray(d.path) ? d.path[0] : null
    if (typeof campo === 'string' && CAMPOS.has(campo)) {
      campos.push({ campo: campo as CampoContrasena, mensaje: d.message })
    } else {
      mensaje ??= d.message
    }
  }
  if (campos.length === 0 && mensaje === null) mensaje = error.message
  return { campos, mensaje }
}
