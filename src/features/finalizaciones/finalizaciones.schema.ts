import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type { MotivoCancelacion } from './finalizaciones.types'

// Schema del formulario de finalización: solo formato (docs/arquitectura-frontend.md →
// Formularios). Que la fecha caiga en el día de la serie, sea posterior al inicio, no pase el fin o
// no tenga turnos pagados lo decide la API. Los motivos y las reglas del detalle son los de
// cancelar (HU-13): se replican porque una feature no importa el `schema` de otra.

export const DETALLE_MAX = 500

/** Motivos en el orden de la lista, con el texto que ve la persona. */
export const MOTIVOS_FINALIZACION: { valor: MotivoCancelacion; etiqueta: string }[] = [
  { valor: 'CANCELACION_ALUMNO', etiqueta: 'Cancelación por el alumno' },
  { valor: 'CANCELACION_PROFESOR', etiqueta: 'Cancelación por el profesor' },
  { valor: 'PROBLEMA_ADMINISTRATIVO', etiqueta: 'Problema administrativo' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

const VALORES = MOTIVOS_FINALIZACION.map((m) => m.valor) as [
  MotivoCancelacion,
  ...MotivoCancelacion[],
]

export const MENSAJE_FECHA_OBLIGATORIA = 'Elegí desde qué fecha se finaliza'
export const MENSAJE_DETALLE_OBLIGATORIO = 'Contanos el motivo en el detalle'

/** Campos del formulario que puede marcar un 400 de la API. */
export const FINALIZACION_FORM_FIELDS = ['fechaDesde', 'motivo', 'detalle'] as const
export type CampoFinalizacionForm = (typeof FINALIZACION_FORM_FIELDS)[number]

const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/

const fechaDesdeSchema = z
  .string()
  .min(1, MENSAJE_FECHA_OBLIGATORIA)
  .regex(FECHA_FORMATO, 'Fecha inválida: debe tener formato AAAA-MM-DD')
  .refine((v) => isValid(parseISO(v)), 'La fecha no es válida')

/** La fecha tiene formato `YYYY-MM-DD` válido: recién entonces se pide la previa. */
export function esFechaConFormato(valor: string | undefined): valor is string {
  return fechaDesdeSchema.safeParse(valor).success
}

export const finalizacionFormSchema = z
  .object({
    fechaDesde: fechaDesdeSchema,
    motivo: z.enum(VALORES, { error: 'Elegí un motivo' }),
    detalle: z.string().max(DETALLE_MAX, `Como máximo ${DETALLE_MAX} caracteres`),
  })
  .superRefine((datos, ctx) => {
    if (datos.motivo === 'OTRO' && datos.detalle.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['detalle'], message: MENSAJE_DETALLE_OBLIGATORIO })
    }
  })

export type FinalizacionFormValues = z.infer<typeof finalizacionFormSchema>

/** Valores del formulario antes de elegir: el motivo arranca vacío (no hay uno por defecto). */
export type FinalizacionFormInicial = {
  fechaDesde: string
  motivo: FinalizacionFormValues['motivo'] | ''
  detalle: string
}

/** El `detalle` sin espacios sobrantes, o `undefined` si quedó vacío. */
export function detalleParaEnviar(detalle: string): string | undefined {
  const limpio = detalle.trim()
  return limpio === '' ? undefined : limpio
}
