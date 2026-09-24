import { z } from '@hono/zod-openapi'

// Primitivas de validación comunes (docs/convenciones-backend.md → Especificación de shared/).
// Los mensajes viajan al usuario en `details` del 400 VALIDACION: van en español.

const DNI_SEPARADORES = /[.\s]/g
const DNI_FORMATO = /^\d{7,8}$/
const EMAIL_MAX = 254
const TELEFONO_CARACTERES = /^[\d\s+\-()]+$/
const TELEFONO_MIN = 8
const TELEFONO_MAX = 20
const TELEFONO_MIN_DIGITOS = 8
// Letras de cualquier alfabeto (con sus marcas de acento), espacio, apóstrofo recto o tipográfico y
// guion. Sin \s: un tab o un salto de línea no son parte de un nombre.
const NOMBRE_CARACTERES = /^[\p{L}\p{M} '’-]+$/u
const NOMBRE_ALGUNA_LETRA = /\p{L}/u
// HH:mm de 00:00 a 23:59.
const HORA_FORMATO = /^([01]\d|2[0-3]):([0-5]\d)$/
const MINUTOS_POR_DIA = 1440

const MENSAJE_TEXTO = 'Debe ser un texto'
const MENSAJE_OBLIGATORIO = 'Campo obligatorio'

/**
 * DNI. Entrada: texto con o sin puntos y espacios (`"30.123.456"`).
 * Salida: solo dígitos, 7 u 8 (`"30123456"`).
 */
export const dni = z
  .string({ error: MENSAJE_TEXTO })
  .transform((valor) => valor.replace(DNI_SEPARADORES, ''))
  .pipe(z.string().regex(DNI_FORMATO, { error: 'El DNI debe tener 7 u 8 dígitos' }))
  .openapi({
    type: 'string',
    description: 'DNI: se aceptan puntos y espacios; se devuelve solo con dígitos (7 u 8)',
    example: '30123456',
  })

/**
 * Email. Entrada: texto con espacios alrededor o mayúsculas (`"  Ana.Perez@Mail.com "`).
 * Salida: recortado y en minúsculas (`"ana.perez@mail.com"`), válido y de hasta 254 caracteres.
 */
export const email = z
  .string({ error: MENSAJE_TEXTO })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: 'Email inválido' })
      .max(EMAIL_MAX, { error: `El email no puede superar los ${EMAIL_MAX} caracteres` }),
  )
  .openapi({
    type: 'string',
    description: 'Email: se guarda recortado y en minúsculas',
    example: 'ana.perez@mail.com',
  })

/**
 * Teléfono. Entrada: dígitos, espacios, `+`, `-` y paréntesis; 8 a 20 caracteres y al menos
 * 8 dígitos. Salida: tal como lo escribió el usuario, solo recortado (`"(387) 15-412-3456"`).
 */
export const telefono = z
  .string({ error: MENSAJE_TEXTO })
  .trim()
  .min(TELEFONO_MIN, { error: `El teléfono debe tener al menos ${TELEFONO_MIN} caracteres` })
  .max(TELEFONO_MAX, { error: `El teléfono no puede superar los ${TELEFONO_MAX} caracteres` })
  .regex(TELEFONO_CARACTERES, {
    error: 'El teléfono solo puede tener dígitos, espacios, +, - y paréntesis',
  })
  .refine((valor) => (valor.match(/\d/g) ?? []).length >= TELEFONO_MIN_DIGITOS, {
    error: `El teléfono debe tener al menos ${TELEFONO_MIN_DIGITOS} dígitos`,
  })
  .openapi({ description: 'Teléfono: se devuelve tal como se cargó', example: '(387) 15-412-3456' })

/**
 * Texto obligatorio. Entrada: texto. Salida: recortado, entre 1 y `max` caracteres.
 * Lanza `RangeError` si `max` no es un entero >= 1 (error de programación).
 */
export function textoRequerido(max: number) {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`textoRequerido: max debe ser un entero >= 1 (recibió ${max})`)
  }
  return z
    .string({ error: MENSAJE_OBLIGATORIO })
    .trim()
    .min(1, { error: MENSAJE_OBLIGATORIO })
    .max(max, { error: `No puede superar los ${max} caracteres` })
}

/**
 * Nombre o apellido de una persona. Entrada: texto con letras (con tildes, ñ, ü…), espacios,
 * apóstrofos y guiones (`"María José"`, `"O'Connor"`, `"Pérez-Gil"`). Salida: recortado, entre 1 y
 * `max` caracteres y con al menos una letra. Rechaza números y otros símbolos.
 */
export function nombrePersona(max: number) {
  return textoRequerido(max)
    .regex(NOMBRE_CARACTERES, {
      error: 'Solo puede tener letras, espacios, apóstrofos y guiones',
    })
    .regex(NOMBRE_ALGUNA_LETRA, { error: 'Debe tener al menos una letra' })
}

/**
 * Fecha de calendario. Entrada y salida: string `YYYY-MM-DD` de una fecha real
 * (`2026-02-30` falla). No se convierte a `Date`.
 */
export const fechaISO = z.iso
  .date({ error: 'Fecha inválida: debe ser una fecha real con formato AAAA-MM-DD' })
  .openapi({ description: 'Fecha de calendario (AAAA-MM-DD)', example: '2026-09-22' })

/** Hora. Entrada y salida: string `HH:mm` de `00:00` a `23:59`. */
export const horaHHmm = z
  .string({ error: MENSAJE_TEXTO })
  .regex(HORA_FORMATO, { error: 'Hora inválida: debe tener formato HH:mm (00:00 a 23:59)' })
  .openapi({ description: 'Hora (HH:mm, 00:00 a 23:59)', example: '09:30' })

/**
 * `"HH:mm"` → minutos desde medianoche (`"09:30"` → 570).
 * Lanza `RangeError` si no es una hora `HH:mm` válida.
 */
export function horaAMinutos(hora: string): number {
  const partes = HORA_FORMATO.exec(hora)
  if (!partes) throw new RangeError(`Hora inválida: "${hora}" (se espera HH:mm)`)
  return Number(partes[1]) * 60 + Number(partes[2])
}

/**
 * Minutos desde medianoche → `"HH:mm"` (570 → `"09:30"`).
 * Lanza `RangeError` si no es un entero de 0 a 1439.
 */
export function minutosAHora(minutos: number): string {
  if (!Number.isInteger(minutos) || minutos < 0 || minutos >= MINUTOS_POR_DIA) {
    throw new RangeError(`Minutos inválidos: ${minutos} (se espera un entero de 0 a 1439)`)
  }
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0')
  const resto = String(minutos % 60).padStart(2, '0')
  return `${horas}:${resto}`
}
