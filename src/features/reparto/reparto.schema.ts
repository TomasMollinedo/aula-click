import { z } from 'zod'

/** El mismo mensaje que la API para un porcentaje fuera de rango o con más de dos decimales. */
export const MENSAJE_PORCENTAJE =
  'El porcentaje debe ser mayor o igual a 0 y menor que 100, con hasta dos decimales'

// Dígitos con, a lo sumo, un separador decimal (coma o punto) y hasta dos decimales.
const FORMATO_PORCENTAJE = /^(\d+)(?:[.,](\d{1,2}))?$/

type LecturaPorcentaje = { ok: true; valor: number } | { ok: false; mensaje: string }

/**
 * Lee el porcentaje tal como se escribe en el formulario: acepta coma o punto como separador
 * decimal, hasta dos decimales, de 0 a 99,99, igual que la API. Que sea distinto del vigente lo
 * decide la API.
 */
export function leerPorcentaje(texto: string): LecturaPorcentaje {
  const limpio = texto.trim()
  if (limpio === '') return { ok: false, mensaje: 'Campo obligatorio' }

  const partes = FORMATO_PORCENTAJE.exec(limpio)
  if (!partes) return { ok: false, mensaje: MENSAJE_PORCENTAJE }

  const valor = Number(`${partes[1]}.${partes[2] ?? '0'}`)
  if (valor >= 100) return { ok: false, mensaje: MENSAJE_PORCENTAJE }
  return { ok: true, valor }
}

// El porcentaje queda como texto en el formulario y pasa a número al confirmar.
export const porcentajeFormSchema = z.object({
  porcentaje: z.string({ message: 'Campo obligatorio' }).superRefine((texto, ctx) => {
    const lectura = leerPorcentaje(texto)
    if (!lectura.ok) ctx.addIssue({ code: 'custom', message: lectura.mensaje })
  }),
})

export type PorcentajeFormValues = z.input<typeof porcentajeFormSchema>

export const PORCENTAJE_FORM_VACIO: PorcentajeFormValues = { porcentaje: '' }
