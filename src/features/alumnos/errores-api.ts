import type { UseFormSetError } from 'react-hook-form'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoFormValues } from './alumnos.schema'
import { ALUMNO_FORM_FIELDS } from './alumnos.schema'

const camposValidos = new Set<string>(ALUMNO_FORM_FIELDS)

type ResultadoErrores = {
  errorGeneral: string | null
}

/**
 * Mapea un ApiError de la API a errores del formulario. Devuelve un error general
 * si hay mensajes que no corresponden a campos. Pone el foco en el primer campo con error.
 */
export function aplicarErroresApi(
  error: ApiError,
  setError: UseFormSetError<AlumnoFormValues>,
  formRef?: React.RefObject<HTMLFormElement | null>,
): ResultadoErrores {
  if (error.status === 403 && error.code === 'SIN_PERMISO') {
    return { errorGeneral: 'No tenés permiso para esta operación' }
  }

  const details = Array.isArray(error.details) ? error.details : []
  let errorGeneral: string | null = null
  let primerCampo: string | null = null

  if (error.status === 400 && error.code === 'VALIDACION') {
    for (const item of details) {
      const path = Array.isArray(item.path) ? item.path[0] : null
      if (typeof path === 'string' && camposValidos.has(path)) {
        setError(path as keyof AlumnoFormValues, { message: item.message })
        if (!primerCampo) primerCampo = path
      } else {
        errorGeneral = errorGeneral ?? item.message ?? error.message
      }
    }
    if (!primerCampo && !errorGeneral) {
      errorGeneral = error.message
    }
  } else if (error.status === 409 && error.code === 'CONFLICTO') {
    const dniDetail = details.find(
      (d: { path?: string[] }) => Array.isArray(d.path) && d.path[0] === 'dni',
    )
    if (dniDetail) {
      setError('dni', { message: dniDetail.message })
      primerCampo = 'dni'
    } else {
      errorGeneral = error.message
    }
  } else {
    errorGeneral = error.message
  }

  if (primerCampo && formRef?.current) {
    const el = formRef.current.querySelector<HTMLElement>(`[name="${primerCampo}"]`)
    el?.focus()
  }

  return { errorGeneral }
}
