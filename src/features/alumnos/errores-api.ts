import type { UseFormSetError } from 'react-hook-form'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoFormValues } from './alumnos.schema'
import { ALUMNO_FORM_FIELDS } from './alumnos.schema'

const camposValidos = new Set<string>(ALUMNO_FORM_FIELDS)

type ResultadoErrores = {
  errorGeneral: string | null
  /** Campos del formulario que el error marca, en orden, con su mensaje. */
  camposMarcados: { campo: keyof AlumnoFormValues; mensaje: string }[]
}

/**
 * Interpreta un ApiError para el formulario, sin efectos: qué campos marcar y qué error general
 * mostrar (mensajes que no corresponden a un campo). Se puede calcular en el render.
 */
export function interpretarErroresApi(error: ApiError): ResultadoErrores {
  if (error.status === 403 && error.code === 'SIN_PERMISO') {
    return { errorGeneral: 'No tenés permiso para esta operación', camposMarcados: [] }
  }

  const details = Array.isArray(error.details) ? error.details : []
  let errorGeneral: string | null = null
  const camposMarcados: ResultadoErrores['camposMarcados'] = []

  if (error.status === 400 && error.code === 'VALIDACION') {
    for (const item of details) {
      const path = Array.isArray(item.path) ? item.path[0] : null
      if (typeof path === 'string' && camposValidos.has(path)) {
        camposMarcados.push({ campo: path as keyof AlumnoFormValues, mensaje: item.message })
      } else {
        errorGeneral = errorGeneral ?? item.message ?? error.message
      }
    }
    if (camposMarcados.length === 0 && !errorGeneral) {
      errorGeneral = error.message
    }
  } else if (error.status === 409 && error.code === 'CONFLICTO') {
    const dniDetail = details.find(
      (d: { path?: string[] }) => Array.isArray(d.path) && d.path[0] === 'dni',
    )
    if (dniDetail) {
      camposMarcados.push({ campo: 'dni', mensaje: dniDetail.message })
    } else {
      errorGeneral = error.message
    }
  } else {
    errorGeneral = error.message
  }

  return { errorGeneral, camposMarcados }
}

/**
 * Mapea un ApiError de la API a errores del formulario (`setError`). Devuelve un error general
 * si hay mensajes que no corresponden a campos. Pone el foco en el primer campo con error.
 */
export function aplicarErroresApi(
  error: ApiError,
  setError: UseFormSetError<AlumnoFormValues>,
  formRef?: React.RefObject<HTMLFormElement | null>,
): ResultadoErrores {
  const resultado = interpretarErroresApi(error)

  for (const { campo, mensaje } of resultado.camposMarcados) {
    setError(campo, { message: mensaje })
  }

  const primerCampo = resultado.camposMarcados[0]?.campo
  if (primerCampo && formRef?.current) {
    const el = formRef.current.querySelector<HTMLElement>(`[name="${primerCampo}"]`)
    el?.focus()
  }

  return resultado
}
