import type { ApiError } from '@/utils/fetch-json'

import { type CampoExamenForm, EXAMEN_FORM_FIELDS, TIPOS_EXAMEN } from './examenes.schema'
import type { ExamenPendiente } from './examenes.types'

// Errores de la API de exámenes (docs/contrato-api.md → Exámenes y Errores) en lo que muestra la
// UI. Es el único lugar que conoce la forma de sus `details`.

export const CODIGO_EXAMEN_PENDIENTE = 'EXAMEN_PENDIENTE'
export const CODIGO_MATERIA_INACTIVA = 'MATERIA_INACTIVA'

const MENSAJE_SIN_PERMISO =
  'No tenés permiso para esta operación: solo podés cargar, editar o eliminar exámenes de las materias que le dictás a este alumno'

const CAMPOS = new Set<string>(EXAMEN_FORM_FIELDS)
const TIPOS = new Set<string>(TIPOS_EXAMEN.map((t) => t.valor))

export type ErrorExamen =
  /** 400 por campo, o 409 `MATERIA_INACTIVA` sobre la materia. `mensaje`: lo que no es de un campo. */
  | {
      tipo: 'campos'
      camposMarcados: { campo: CampoExamenForm; mensaje: string }[]
      mensaje: string | null
    }
  /** 409 `EXAMEN_PENDIENTE`: ya hay un examen pendiente de esa materia; se ofrece editarlo. */
  | { tipo: 'pendiente'; mensaje: string; existente: ExamenPendiente }
  | { tipo: 'general'; mensaje: string }

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

function esExamenPendiente(valor: unknown): valor is ExamenPendiente {
  return (
    esRegistro(valor) &&
    typeof valor.id === 'number' &&
    typeof valor.fecha === 'string' &&
    typeof valor.tipo === 'string' &&
    TIPOS.has(valor.tipo)
  )
}

/**
 * Convierte un ApiError del alta o la edición de un examen en lo que muestra el formulario. Los
 * `details` de `EXAMEN_PENDIENTE` son un objeto (`{ id, tipo, fecha }`, sin arreglo); si no tienen
 * esa forma, cae al mensaje general de la API.
 */
export function interpretarErrorExamen(error: ApiError): ErrorExamen {
  if (error.status === 403) return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO }

  if (error.status === 409 && error.code === CODIGO_EXAMEN_PENDIENTE) {
    return esExamenPendiente(error.details)
      ? { tipo: 'pendiente', mensaje: error.message, existente: error.details }
      : { tipo: 'general', mensaje: error.message }
  }

  const porCampo =
    (error.status === 400 && error.code === 'VALIDACION') ||
    (error.status === 409 && error.code === CODIGO_MATERIA_INACTIVA)
  if (porCampo) {
    const details = Array.isArray(error.details) ? (error.details as unknown[]) : []
    const camposMarcados: { campo: CampoExamenForm; mensaje: string }[] = []
    let mensaje: string | null = null
    for (const d of details) {
      if (!esRegistro(d) || typeof d.message !== 'string') continue
      const campo = Array.isArray(d.path) ? d.path[0] : null
      if (typeof campo === 'string' && CAMPOS.has(campo)) {
        camposMarcados.push({ campo: campo as CampoExamenForm, mensaje: d.message })
      } else {
        mensaje ??= d.message
      }
    }
    if (camposMarcados.length === 0 && mensaje === null) mensaje = error.message
    return { tipo: 'campos', camposMarcados, mensaje }
  }

  return { tipo: 'general', mensaje: error.message }
}

/** Mensaje de un error de una acción sin formulario (eliminar). */
export function mensajeErrorAccion(error: ApiError): string {
  return error.status === 403 ? MENSAJE_SIN_PERMISO : error.message
}
