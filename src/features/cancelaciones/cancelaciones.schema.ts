import { z } from 'zod'

import type { MotivoCancelacion } from './cancelaciones.types'

export const DETALLE_MAX = 500

/** Motivos en el orden de la lista, con el texto que ve la persona. */
export const MOTIVOS_CANCELACION: { valor: MotivoCancelacion; etiqueta: string }[] = [
  { valor: 'CANCELACION_ALUMNO', etiqueta: 'Cancelación por el alumno' },
  { valor: 'CANCELACION_PROFESOR', etiqueta: 'Cancelación por el profesor' },
  { valor: 'PROBLEMA_ADMINISTRATIVO', etiqueta: 'Problema administrativo' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const VALORES = MOTIVOS_CANCELACION.map((m) => m.valor) as [
  MotivoCancelacion,
  ...MotivoCancelacion[],
]

export const MENSAJE_DETALLE_OBLIGATORIO = 'Contanos el motivo en el detalle'

/** Campos del formulario que puede marcar un 400 de la API. */
export const CANCELACION_FORM_FIELDS = ['motivo', 'detalle'] as const
export type CampoCancelacionForm = (typeof CANCELACION_FORM_FIELDS)[number]

export const cancelacionFormSchema = z
  .object({
    motivo: z.enum(VALORES, { error: 'Elegí un motivo' }),
    detalle: z.string().max(DETALLE_MAX, `Como máximo ${DETALLE_MAX} caracteres`),
  })
  .superRefine((datos, ctx) => {
    if (datos.motivo === 'OTRO' && datos.detalle.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO })
    }
  })

export type CancelacionFormValues = z.infer<typeof cancelacionFormSchema>

/** Valores del formulario antes de elegir: el motivo arranca vacío (no hay uno por defecto). */
export type CancelacionFormInicial = {
  motivo: CancelacionFormValues['motivo'] | ''
  detalle: string
}

export const CANCELACION_FORM_VACIO: CancelacionFormInicial = { motivo: '', detalle: '' }

/** El `detalle` sin espacios sobrantes, o `undefined` si quedó vacío. */
export function detalleParaEnviar(detalle: string): string | undefined {
  const limpio = detalle.trim()
  return limpio === '' ? undefined : limpio
}
