import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'

import type { AlumnoCrear, AlumnoDetalle, AlumnoEditar } from './alumnos.types'

// Valor especial para el Select de nivel: Radix no admite value="".
export const SIN_NIVEL = '__SIN_NIVEL__'

const SEPARADORES_DNI = /[.\s]/g
const DNI_FORMATO = /^\d{7,8}$/
const TELEFONO_CARACTERES = /^[\d\s+\-()]+$/
const TELEFONO_MIN_DIGITOS = 8
const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/

const dniSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .transform((v) => v.replace(SEPARADORES_DNI, ''))
  .pipe(z.string().regex(DNI_FORMATO, { message: 'El DNI debe tener 7 u 8 dígitos' }))

const dniOpcionalSchema = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(SEPARADORES_DNI, '') : v))
  .pipe(
    z
      .string()
      .regex(DNI_FORMATO, { message: 'El DNI debe tener 7 u 8 dígitos' })
      .optional()
      .or(z.literal('')),
  )

const telefonoSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .min(8, { message: 'El teléfono debe tener al menos 8 caracteres' })
  .max(20, { message: 'El teléfono no puede superar los 20 caracteres' })
  .regex(TELEFONO_CARACTERES, {
    message: 'El teléfono solo puede tener dígitos, espacios, +, - y paréntesis',
  })
  .refine((v) => (v.match(/\d/g) ?? []).length >= TELEFONO_MIN_DIGITOS, {
    message: 'El teléfono debe tener al menos 8 dígitos',
  })

const telefonoOpcionalSchema = z
  .string()
  .optional()
  .or(z.literal(''))
  .pipe(
    z
      .string()
      .max(20, { message: 'El teléfono no puede superar los 20 caracteres' })
      .regex(TELEFONO_CARACTERES, {
        message: 'El teléfono solo puede tener dígitos, espacios, +, - y paréntesis',
      })
      .refine((v) => (v.match(/\d/g) ?? []).length >= TELEFONO_MIN_DIGITOS, {
        message: 'El teléfono debe tener al menos 8 dígitos',
      })
      .optional()
      .or(z.literal('')),
  )

const emailFormatoSchema = z
  .email({ message: 'Email inválido' })
  .max(254, { message: 'El email no puede superar los 254 caracteres' })

const emailOpcionalSchema = z
  .string()
  .trim()
  .optional()
  .pipe(z.union([z.literal(''), emailFormatoSchema]).optional())

// Los datos del tutor de un menor no se validan acá: es una regla de negocio que valida la API
// (T-28). edad.ts solo decide el aviso y los asteriscos del formulario.
export const alumnoFormSchema = z.object({
  nombre: z
    .string({ message: 'Campo obligatorio' })
    .trim()
    .min(1, { message: 'Campo obligatorio' })
    .max(100, { message: 'No puede superar los 100 caracteres' }),
  apellido: z
    .string({ message: 'Campo obligatorio' })
    .trim()
    .min(1, { message: 'Campo obligatorio' })
    .max(100, { message: 'No puede superar los 100 caracteres' }),
  dni: dniSchema,
  fechaNacimiento: z
    .string({ message: 'Campo obligatorio' })
    .min(1, { message: 'Campo obligatorio' })
    .regex(FECHA_FORMATO, { message: 'Fecha inválida: debe tener formato AAAA-MM-DD' })
    .refine((v) => isValid(parseISO(v)), { message: 'La fecha no es válida' }),
  email: z
    .string({ message: 'Campo obligatorio' })
    .trim()
    .min(1, { message: 'Campo obligatorio' })
    .pipe(emailFormatoSchema),
  telefono: telefonoSchema,
  nivelEscolaridad: z.string().optional().or(z.literal('')),
  grado: z
    .string()
    .max(50, { message: 'No puede superar los 50 caracteres' })
    .optional()
    .or(z.literal('')),
  institucionEducativa: z
    .string()
    .max(150, { message: 'No puede superar los 150 caracteres' })
    .optional()
    .or(z.literal('')),
  observaciones: z
    .string()
    .max(2000, { message: 'No puede superar los 2000 caracteres' })
    .optional()
    .or(z.literal('')),
  tutorNombre: z
    .string()
    .max(100, { message: 'No puede superar los 100 caracteres' })
    .optional()
    .or(z.literal('')),
  tutorApellido: z
    .string()
    .max(100, { message: 'No puede superar los 100 caracteres' })
    .optional()
    .or(z.literal('')),
  tutorDni: dniOpcionalSchema,
  tutorTelefono: telefonoOpcionalSchema,
  tutorEmail: emailOpcionalSchema,
})

export type AlumnoFormValues = z.input<typeof alumnoFormSchema>

export const ALUMNO_FORM_FIELDS = Object.keys(alumnoFormSchema.shape) as (keyof AlumnoFormValues)[]

/** Valores del formulario de alta: todo vacío y el nivel sin elegir (muestra el placeholder). */
export const ALUMNO_FORM_VACIO: AlumnoFormValues = {
  nombre: '',
  apellido: '',
  dni: '',
  fechaNacimiento: '',
  email: '',
  telefono: '',
  nivelEscolaridad: '',
  grado: '',
  institucionEducativa: '',
  observaciones: '',
  tutorNombre: '',
  tutorApellido: '',
  tutorDni: '',
  tutorTelefono: '',
  tutorEmail: '',
}

/** `alumnoId` de la URL como número, o `null` si no es un entero positivo (se muestra 404). */
export function parsearAlumnoId(alumnoId: string): number | null {
  const id = Number(alumnoId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Convierte el detalle de la API a valores del formulario: null → "" (el nivel sin elegir, también). */
export function detalleAValoresForm(detalle: AlumnoDetalle): AlumnoFormValues {
  return {
    nombre: detalle.nombre,
    apellido: detalle.apellido,
    dni: detalle.dni,
    fechaNacimiento: detalle.fechaNacimiento,
    email: detalle.email,
    telefono: detalle.telefono,
    nivelEscolaridad: detalle.nivelEscolaridad ?? '',
    grado: detalle.grado ?? '',
    institucionEducativa: detalle.institucionEducativa ?? '',
    observaciones: detalle.observaciones ?? '',
    tutorNombre: detalle.tutorNombre ?? '',
    tutorApellido: detalle.tutorApellido ?? '',
    tutorDni: detalle.tutorDni ?? '',
    tutorTelefono: detalle.tutorTelefono ?? '',
    tutorEmail: detalle.tutorEmail ?? '',
  }
}

/** Convierte los valores del formulario al body del POST: "" → null en opcionales. */
export function valoresFormACrear(valores: AlumnoFormValues): AlumnoCrear {
  return {
    nombre: valores.nombre,
    apellido: valores.apellido,
    dni: valores.dni,
    fechaNacimiento: valores.fechaNacimiento,
    email: valores.email,
    telefono: valores.telefono,
    nivelEscolaridad: textoANullable(valores.nivelEscolaridad) as AlumnoCrear['nivelEscolaridad'],
    grado: textoANullable(valores.grado),
    institucionEducativa: textoANullable(valores.institucionEducativa),
    observaciones: textoANullable(valores.observaciones),
    tutorNombre: textoANullable(valores.tutorNombre),
    tutorApellido: textoANullable(valores.tutorApellido),
    tutorDni: textoANullable(valores.tutorDni),
    tutorTelefono: textoANullable(valores.tutorTelefono),
    tutorEmail: textoANullable(valores.tutorEmail),
  }
}

/**
 * Convierte los valores del formulario al body del PATCH: solo los campos modificados,
 * con "" → null. Devuelve null si no hay cambios.
 */
export function valoresFormAEditar(
  valores: AlumnoFormValues,
  dirtyFields: Partial<Record<keyof AlumnoFormValues, boolean>>,
): AlumnoEditar | null {
  const cambios: AlumnoEditar = {}
  let hayCambios = false

  for (const key of ALUMNO_FORM_FIELDS) {
    if (!dirtyFields[key]) continue
    hayCambios = true
    const valor = valores[key]

    if (key === 'nivelEscolaridad') {
      ;(cambios as Record<string, unknown>)[key] = textoANullable(valor) ?? null
    } else if (
      key === 'nombre' ||
      key === 'apellido' ||
      key === 'dni' ||
      key === 'fechaNacimiento' ||
      key === 'email' ||
      key === 'telefono'
    ) {
      ;(cambios as Record<string, unknown>)[key] = valor
    } else {
      ;(cambios as Record<string, unknown>)[key] = textoANullable(valor)
    }
  }

  return hayCambios ? cambios : null
}

function textoANullable(valor: string | undefined): string | null {
  if (!valor || valor === SIN_NIVEL) return null
  const trimmed = valor.trim()
  return trimmed === '' ? null : trimmed
}
