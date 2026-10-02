import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type { OcurrenciaACobrar } from '@/types/pago'

import type { RegistrarPago } from './pagos.types'

// Schema del formulario de registrar un pago: solo formato y campos obligatorios
// (docs/arquitectura-frontend.md → Formularios). Que la fecha de pago no sea futura, que el monto
// recibido alcance el total y qué turnos se pueden cobrar los decide la API, y sus 400 se muestran
// en el campo. Las ocurrencias no son campos: llegan de quien abre el diálogo.

const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/
const MAX_OBSERVACIONES = 500
// `parsearMonto`: los formatos que acepta. El primer grupo de miles no empieza con 0 y los
// centavos son uno o dos dígitos.
const SOLO_DIGITOS = /^\d+$/
const MILES_CON_PUNTO = /^[1-9]\d{0,2}(\.\d{3})+$/
const DECIMAL_CON_PUNTO = /^(\d+)\.(\d{1,2})$/
const DECIMAL_CON_COMA = /^(\d+|[1-9]\d{0,2}(?:\.\d{3})+),(\d{1,2})$/

/**
 * Lee el monto que escribe quien cobra. Devuelve el número, o `null` si el texto está vacío o no se
 * puede leer sin ambigüedad. Criterio:
 *
 * - Descarta todos los espacios y un `$` inicial (`'$ 32.000'`).
 * - Solo dígitos: entero (`'32000'`).
 * - La **coma** es siempre el separador decimal (`'32000,50'`), y la parte entera puede llevar
 *   puntos de miles (`'1.234.567,50'`).
 * - El **punto** es de miles solo si el texto completo sigue el patrón de grupos de 3 y no hay coma
 *   (`'32.000'` → 32000, `'1.234.567'` → 1234567). Si no, un único punto es decimal
 *   (`'32000.5'` → 32000.5).
 * - Los centavos son **uno o dos dígitos**: más decimales no son un importe en pesos, y una coma
 *   seguida de tres dígitos (`'32,000'`) es ambigua (¿miles al estilo inglés?). Así, "hasta dos
 *   decimales" ya lo cubre la lectura.
 * - Rechaza lo ambiguo o inválido: punto y coma al estilo inglés (`'1,234.56'`), más de una coma,
 *   puntos que no forman grupos de 3 (`'32.000.5'`), signos, letras, o un separador sin dígitos a
 *   algún lado (`'.5'`, `'5,'`).
 *
 * No valida el rango: `'0'` se lee 0. "Mayor a 0" lo marca el schema del formulario; el tope y
 * "mayor o igual al total", la API.
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/\s+/g, '').replace(/^\$/, '')
  if (limpio === '') return null

  let normalizado: string | null = null
  if (SOLO_DIGITOS.test(limpio)) {
    normalizado = limpio
  } else if (MILES_CON_PUNTO.test(limpio)) {
    normalizado = limpio.replaceAll('.', '')
  } else {
    const conComa = DECIMAL_CON_COMA.exec(limpio)
    const conPunto = DECIMAL_CON_PUNTO.exec(limpio)
    if (conComa) normalizado = `${conComa[1].replaceAll('.', '')}.${conComa[2]}`
    else if (conPunto) normalizado = `${conPunto[1]}.${conPunto[2]}`
  }

  return normalizado === null ? null : Number(normalizado)
}

/** Fecha `YYYY-MM-DD` obligatoria y válida (mismo criterio que `turnos.schema.ts`). */
const fechaPagoSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .pipe(
    z
      .string()
      .regex(FECHA_FORMATO, {
        message: 'Fecha inválida: debe tener formato AAAA-MM-DD',
        abort: true,
      })
      .refine((v) => isValid(parseISO(v)), { message: 'La fecha no es válida' }),
  )

/**
 * Obligatorio: el pago es en efectivo y con el monto recibido la API calcula el vuelto. Se lee con
 * `parsearMonto` (que ya exige hasta dos decimales) y tiene que ser mayor a 0. No se compara con el
 * total: ese 400 lo da la API en el campo.
 */
const montoRecibidoSchema = z
  .string({ message: 'Campo obligatorio' })
  .refine((v) => v.trim() !== '', { message: 'Campo obligatorio', abort: true })
  .refine((v) => parsearMonto(v) !== null, {
    message: 'Monto inválido: usá números con hasta dos decimales (por ejemplo 32.000 o 32000,50)',
    abort: true,
  })
  .refine((v) => (parsearMonto(v) ?? 0) > 0, { message: 'Debe ser mayor a 0' })

const observacionesSchema = z
  .string()
  .max(MAX_OBSERVACIONES, { message: `No puede superar los ${MAX_OBSERVACIONES} caracteres` })
  .optional()
  .or(z.literal(''))

export const pagoFormSchema = z.object({
  fechaPago: fechaPagoSchema,
  montoRecibido: montoRecibidoSchema,
  observaciones: observacionesSchema,
})

export type PagoFormValues = z.input<typeof pagoFormSchema>

/** Campos del formulario que un 400 de la API puede marcar. */
export const CAMPOS_PAGO_FORM = ['fechaPago', 'montoRecibido', 'observaciones'] as const

export type CampoPagoForm = (typeof CAMPOS_PAGO_FORM)[number]

/**
 * Valores iniciales: la fecha de pago es `hoy` (la fecha local del navegador, `YYYY-MM-DD`, que
 * pasa quien monta el formulario). Qué es "hoy" para la regla lo decide la API.
 */
export function valoresInicialesPago(hoy: string): PagoFormValues {
  return { fechaPago: hoy, montoRecibido: '', observaciones: '' }
}

/**
 * Body del `POST /pagos`. Las ocurrencias van como pares `(turnoId, fecha)` **en el mismo orden en
 * que se muestran**: la API devuelve sus errores por posición (`path: ['ocurrencias', i]`) y
 * `errores-pagos.ts` los resuelve contra esa misma lista. Las observaciones van sin espacios
 * alrededor, omitidas si quedan vacías.
 *
 * `valores` ya pasó por `pagoFormSchema`, así que el monto se puede leer. Si no se pudiera, viaja
 * `0`: la API lo rechaza con su 400 en el campo y nunca se registra un pago sin monto.
 */
export function armarRegistrarPago(
  alumnoId: number,
  ocurrencias: readonly Pick<OcurrenciaACobrar, 'turnoId' | 'fecha'>[],
  valores: PagoFormValues,
): RegistrarPago {
  const montoRecibido = parsearMonto(valores.montoRecibido) ?? 0
  const observaciones = valores.observaciones?.trim()

  return {
    alumnoId,
    ocurrencias: ocurrencias.map(({ turnoId, fecha }) => ({ turnoId, fecha })),
    fechaPago: valores.fechaPago,
    montoRecibido,
    ...(observaciones ? { observaciones } : {}),
  }
}
