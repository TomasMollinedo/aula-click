import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaProfesor } from './materias.types'

// Errores de la API de materias en lo que muestra la UI (docs/contrato-api.md → Errores). Es el
// único lugar que conoce la forma de sus `details`.

// Campo por el que la API informa un 409 CONFLICTO: el nombre repetido (la comparación no
// distingue mayúsculas ni tildes, así que "Matemática" choca con "matematica").
const CAMPOS_CONFLICTO = new Set(['nombre'])

/** Código del 409 al dar de baja una materia que tiene profesores asignados. */
export const CODIGO_MATERIA_CON_PROFESORES = 'MATERIA_CON_PROFESORES'

type Detalle = { path?: unknown; message: string }

type ResultadoErrores<TCampo extends string> = {
  errorGeneral: string | null
  /** Campos del formulario que el error marca, en orden, con su mensaje. */
  camposMarcados: { campo: TCampo; mensaje: string }[]
}

/**
 * Interpreta un ApiError para el formulario, sin efectos: qué campos marcar y qué error general
 * mostrar (mensajes que no corresponden a un campo). Se puede calcular en el render.
 * `camposValidos` son los nombres de campo del formulario que llama.
 */
export function interpretarErroresApi<TCampo extends string>(
  error: ApiError,
  camposValidos: ReadonlySet<TCampo>,
): ResultadoErrores<TCampo> {
  if (error.status === 403 && error.code === 'SIN_PERMISO') {
    return { errorGeneral: 'No tenés permiso para esta operación', camposMarcados: [] }
  }

  const details = Array.isArray(error.details) ? (error.details as Detalle[]) : []
  let errorGeneral: string | null = null
  const camposMarcados: ResultadoErrores<TCampo>['camposMarcados'] = []

  if (error.status === 400 && error.code === 'VALIDACION') {
    for (const item of details) {
      const path = Array.isArray(item.path) ? item.path[0] : null
      if (typeof path === 'string' && camposValidos.has(path as TCampo)) {
        camposMarcados.push({ campo: path as TCampo, mensaje: item.message })
      } else {
        errorGeneral = errorGeneral ?? item.message ?? error.message
      }
    }
    if (camposMarcados.length === 0 && !errorGeneral) {
      errorGeneral = error.message
    }
  } else if (error.status === 409 && error.code === 'CONFLICTO') {
    const conflictos = details.filter(
      (d): d is Detalle & { path: string[] } =>
        Array.isArray(d.path) && typeof d.path[0] === 'string' && CAMPOS_CONFLICTO.has(d.path[0]),
    )
    for (const conflicto of conflictos) {
      const path = conflicto.path[0]
      if (camposValidos.has(path as TCampo)) {
        camposMarcados.push({ campo: path as TCampo, mensaje: conflicto.message })
      }
    }
    if (camposMarcados.length === 0) errorGeneral = error.message
  } else {
    errorGeneral = error.message
  }

  return { errorGeneral, camposMarcados }
}

/**
 * Mapea un ApiError de la API a errores del formulario (`setError`). Devuelve un error general
 * si hay mensajes que no corresponden a campos. Pone el foco en el primer campo con error.
 */
export function aplicarErroresApi<TValues extends FieldValues, TCampo extends string>(
  error: ApiError,
  setError: UseFormSetError<TValues>,
  camposValidos: ReadonlySet<TCampo>,
  formRef?: React.RefObject<HTMLFormElement | null>,
): ResultadoErrores<TCampo> {
  const resultado = interpretarErroresApi(error, camposValidos)

  for (const { campo, mensaje } of resultado.camposMarcados) {
    setError(campo as unknown as Path<TValues>, { message: mensaje })
  }

  const primerCampo = resultado.camposMarcados[0]?.campo
  if (primerCampo && formRef?.current) {
    const el = formRef.current.querySelector<HTMLElement>(`[name="${primerCampo}"]`)
    el?.focus()
  }

  return resultado
}

function esMateriaProfesor(valor: unknown): valor is MateriaProfesor {
  if (typeof valor !== 'object' || valor === null) return false
  const p = valor as Record<string, unknown>
  return (
    typeof p.id === 'number' &&
    typeof p.apellido === 'string' &&
    typeof p.nombre === 'string' &&
    (p.estado === 'ACTIVO' || p.estado === 'INACTIVO')
  )
}

/**
 * Profesores que impiden la baja, de los `details` del 409 `MATERIA_CON_PROFESORES`. Con cualquier
 * otro error devuelve `[]`, y el diálogo muestra solo el `message`.
 */
export function profesoresQueImpidenLaBaja(error: ApiError): MateriaProfesor[] {
  if (error.code !== CODIGO_MATERIA_CON_PROFESORES) return []
  const details = Array.isArray(error.details) ? error.details : []
  return details.filter(esMateriaProfesor)
}
