import { z } from 'zod'

import type { MateriaCrear } from './materias.types'

const NOMBRE_MAX = 100
const DESCRIPCION_MAX = 500

// Mismo formato que `crearMateriaSchema` de la API: nombre obligatorio y descripción opcional. La
// unicidad del nombre no se valida acá: la decide la API y su 409 se muestra sobre el campo.
export const materiaFormSchema = z.object({
  nombre: z
    .string({ message: 'Campo obligatorio' })
    .trim()
    .min(1, { message: 'Campo obligatorio' })
    .max(NOMBRE_MAX, { message: `No puede superar los ${NOMBRE_MAX} caracteres` }),
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

export const MATERIA_FORM_VACIO: MateriaFormValues = { nombre: '', descripcion: '' }

/** Valores del formulario al body del POST: la descripción vacía va como `null`. */
export function valoresFormACrear(valores: MateriaFormValues): MateriaCrear {
  const descripcion = valores.descripcion?.trim()
  return { nombre: valores.nombre.trim(), descripcion: descripcion ? descripcion : null }
}

/** `detalle` de la URL como número, o `null` si no es un entero positivo (se muestra 404). */
export function parsearMateriaId(materiaId: string | null): number | null {
  if (!materiaId) return null
  const id = Number(materiaId)
  return Number.isInteger(id) && id > 0 ? id : null
}
