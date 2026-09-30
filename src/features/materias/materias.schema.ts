import { z } from 'zod'

import { formatearPesos } from '@/utils/moneda'

import type { MateriaCrear, MateriaDetalle } from './materias.types'

const NOMBRE_MAX = 100
const DESCRIPCION_MAX = 500

/** Tope de `precioHora` en la API (`Decimal(10,2)`). */
export const PRECIO_HORA_MAX = 99_999_999.99

export const MENSAJE_PRECIO_FORMATO =
  'Escribí el precio sin puntos de miles, por ejemplo 7500 o 7500,50'

// Dígitos con, a lo sumo, un separador decimal (coma o punto). "7.500,50" (miles con punto) no
// entra: se pide sin separador de miles.
const FORMATO_PRECIO = /^(\d+)(?:[.,](\d+))?$/

type LecturaPrecio = { ok: true; valor: number } | { ok: false; mensaje: string }

/**
 * Lee el precio tal como se escribe en el formulario: acepta coma o punto como separador decimal y
 * hasta dos decimales, igual que la API (mayor a 0 y hasta 99.999.999,99). "7.500" se rechaza en
 * lugar de leerlo como 7,5: con tres dígitos después del punto casi seguro es un separador de miles.
 */
export function leerPrecio(texto: string): LecturaPrecio {
  const limpio = texto.trim()
  if (limpio === '') return { ok: false, mensaje: 'Campo obligatorio' }

  const partes = FORMATO_PRECIO.exec(limpio)
  if (!partes) return { ok: false, mensaje: MENSAJE_PRECIO_FORMATO }

  const decimales = partes[2] ?? ''
  if (decimales.length > 2) {
    const pareceMiles = limpio.includes('.') && decimales.length === 3
    return {
      ok: false,
      mensaje: pareceMiles ? MENSAJE_PRECIO_FORMATO : 'Puede tener hasta dos decimales',
    }
  }

  const valor = Number(`${partes[1]}.${decimales || '0'}`)
  if (valor <= 0) return { ok: false, mensaje: 'Tiene que ser mayor a 0' }
  if (valor > PRECIO_HORA_MAX) {
    return { ok: false, mensaje: `No puede superar ${formatearPesos(PRECIO_HORA_MAX)}` }
  }
  return { ok: true, valor }
}

// Mismo formato que `crearMateriaSchema` de la API: nombre y precio obligatorios, descripción
// opcional. La unicidad del nombre no se valida acá: la decide la API y su 409 se muestra sobre el
// campo. El precio queda como texto en el formulario y pasa a número al armar el body.
export const materiaFormSchema = z.object({
  nombre: z
    .string({ message: 'Campo obligatorio' })
    .trim()
    .min(1, { message: 'Campo obligatorio' })
    .max(NOMBRE_MAX, { message: `No puede superar los ${NOMBRE_MAX} caracteres` }),
  precioHora: z.string({ message: 'Campo obligatorio' }).superRefine((texto, ctx) => {
    const lectura = leerPrecio(texto)
    if (!lectura.ok) ctx.addIssue({ code: 'custom', message: lectura.mensaje })
  }),
  descripcion: z
    .string()
    .max(DESCRIPCION_MAX, { message: `No puede superar los ${DESCRIPCION_MAX} caracteres` })
    .optional()
    .or(z.literal('')),
})

export type MateriaFormValues = z.input<typeof materiaFormSchema>

export const MATERIA_FORM_FIELDS = Object.keys(
  materiaFormSchema.shape,
) as (keyof MateriaFormValues)[]

export const MATERIA_FORM_VACIO: MateriaFormValues = { nombre: '', precioHora: '', descripcion: '' }

/**
 * Valores del formulario (ya validados) al body del POST: el precio como número y la descripción
 * vacía como `null`. El mismo body sirve para el PATCH de la edición.
 */
export function valoresFormACrear(valores: MateriaFormValues): MateriaCrear {
  const descripcion = valores.descripcion?.trim()
  const precio = leerPrecio(valores.precioHora)
  if (!precio.ok) throw new Error(precio.mensaje)
  return {
    nombre: valores.nombre.trim(),
    precioHora: precio.valor,
    descripcion: descripcion ? descripcion : null,
  }
}

/**
 * Detalle de la API a los valores iniciales de la edición. El precio se muestra con coma decimal
 * ("7500,50"), sin separador de miles; sin precio, el campo queda vacío para cargarlo.
 */
export function detalleAValoresForm(materia: MateriaDetalle): MateriaFormValues {
  return {
    nombre: materia.nombre,
    precioHora: materia.precioHora === null ? '' : materia.precioHora.toFixed(2).replace('.', ','),
    descripcion: materia.descripcion ?? '',
  }
}

/** `detalle` o `editar` de la URL como número, o `null` si no es un entero positivo (se muestra 404). */
export function parsearMateriaId(materiaId: string | null): number | null {
  if (!materiaId) return null
  const id = Number(materiaId)
  return Number.isInteger(id) && id > 0 ? id : null
}
