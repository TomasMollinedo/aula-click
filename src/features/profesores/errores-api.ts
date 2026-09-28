import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import type { ApiError } from '@/utils/fetch-json'

// Campos por los que la API puede informar un 409 CONFLICTO (docs/contrato-api.md): DNI, email o
// matrícula repetidos, uno por pedido.
const CAMPOS_CONFLICTO = new Set(['dni', 'email', 'matricula'])

type Detalle = { path?: unknown; message: string }

type ResultadoErrores<TCampo extends string> = {
  errorGeneral: string | null
  /** Campos del formulario que el error marca, en orden, con su mensaje. */
  camposMarcados: { campo: TCampo; mensaje: string }[]
}

/**
 * Interpreta un ApiError para el formulario, sin efectos: qué campos marcar y qué error general
 * mostrar (mensajes que no corresponden a un campo). Se puede calcular en el render.
 * `camposValidos` son los nombres de campo del formulario que llama (distintos entre alta, con
 * `password`, y edición, sin ella).
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
