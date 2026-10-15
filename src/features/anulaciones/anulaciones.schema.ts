import { z } from 'zod'

import type { MotivoAnulacion } from './anulaciones.types'

// Schema del formulario de anulación: solo formato (docs/arquitectura-frontend.md → Formularios).
// Que el pago exista o ya esté anulado lo decide la API.

export const DETALLE_MAX = 500

/** Motivos en el orden de la lista, con el texto que ve la persona. */
export const MOTIVOS_ANULACION: { valor: MotivoAnulacion; etiqueta: string }[] = [
  { valor: 'ERROR_CARGA', etiqueta: 'Error de carga' },
  { valor: 'FORMA_PAGO_EQUIVOCADA', etiqueta: 'Forma de pago equivocada' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const VALORES = MOTIVOS_ANULACION.map((m) => m.valor) as [MotivoAnulacion, ...MotivoAnulacion[]]

export const MENSAJE_DETALLE_OBLIGATORIO = 'Contanos el motivo en el detalle'

/** Campos del formulario que puede marcar un 400 de la API. */
export const ANULACION_FORM_FIELDS = ['motivo', 'detalle'] as const
export type CampoAnulacionForm = (typeof ANULACION_FORM_FIELDS)[number]

export const anulacionFormSchema = z
  .object({
    motivo: z.enum(VALORES, { error: 'Elegí un motivo' }),
    detalle: z.string().max(DETALLE_MAX, `Como máximo ${DETALLE_MAX} caracteres`),
  })
  .superRefine((datos, ctx) => {
    if (datos.motivo === 'OTRO' && datos.detalle.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO })
    }
  })

export type AnulacionFormValues = z.infer<typeof anulacionFormSchema>

/** Valores del formulario antes de elegir: el motivo arranca vacío (no hay uno por defecto). */
export type AnulacionFormInicial = {
  motivo: AnulacionFormValues['motivo'] | ''
  detalle: string
}

/** El `detalle` sin espacios sobrantes, o `undefined` si quedó vacío. */
export function detalleParaEnviar(detalle: string): string | undefined {
  const limpio = detalle.trim()
  return limpio === '' ? undefined : limpio
}
