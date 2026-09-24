import { z } from 'zod'

import { tieneAlgunaLetra, tieneSoloCaracteres } from '@/utils/caracteres'

import type {
  Bloque,
  BloqueCrear,
  BloqueEditar,
  ProfesorCrear,
  ProfesorDetalle,
  ProfesorEditar,
} from './profesores.types'

// Mismo rango que valida la API (T-07, `src/lib/auth-reglas.ts`): los schemas del frontend no
// comparten código con el backend (T-08), así que se replica el valor. Si cambia allá, se cambia acá.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

const SEPARADORES_DNI = /[.\s]/g
const DNI_FORMATO = /^\d{7,8}$/
const TELEFONO_CARACTERES = /^[\d\s+\-()]+$/
const TELEFONO_MIN_DIGITOS = 8
const CAPACIDAD_FORMATO = /^\d+$/

const dniSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .transform((v) => v.replace(SEPARADORES_DNI, ''))
  .pipe(z.string().regex(DNI_FORMATO, { message: 'El DNI debe tener 7 u 8 dígitos' }))

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

const emailSchema = z
  .string({ message: 'Campo obligatorio' })
  .trim()
  .min(1, { message: 'Campo obligatorio' })
  .pipe(
    z
      .email({ message: 'Email inválido' })
      .max(254, { message: 'El email no puede superar los 254 caracteres' }),
  )

const MENSAJE_NOMBRE_CARACTERES = 'Solo puede tener letras, espacios, apóstrofos y guiones'
const MENSAJE_NOMBRE_SIN_LETRAS = 'Debe tener al menos una letra'

// Nombre o apellido: mismo formato que `nombrePersona` de la API (utils/caracteres.ts).
const nombreSchema = z
  .string({ message: 'Campo obligatorio' })
  .trim()
  .min(1, { message: 'Campo obligatorio' })
  .max(100, { message: 'No puede superar los 100 caracteres' })
  .refine((v) => tieneSoloCaracteres(v, 'nombre'), { message: MENSAJE_NOMBRE_CARACTERES })
  .refine(tieneAlgunaLetra, { message: MENSAJE_NOMBRE_SIN_LETRAS })

const tituloSchema = z
  .string({ message: 'Campo obligatorio' })
  .trim()
  .min(1, { message: 'Campo obligatorio' })
  .max(150, { message: 'No puede superar los 150 caracteres' })

const matriculaSchema = z
  .string({ message: 'Campo obligatorio' })
  .trim()
  .min(1, { message: 'Campo obligatorio' })
  .max(50, { message: 'No puede superar los 50 caracteres' })

const capacidadSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .regex(CAPACIDAD_FORMATO, { message: 'Debe ser un número entero' })
  .refine((v) => Number(v) >= 1, { message: 'Debe ser mayor o igual a 1' })

const passwordSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(PASSWORD_MIN, { message: `Debe tener al menos ${PASSWORD_MIN} caracteres` })
  .max(PASSWORD_MAX, { message: `No puede superar los ${PASSWORD_MAX} caracteres` })

// Campos comunes al alta y a la edición.
const camposProfesor = {
  nombre: nombreSchema,
  apellido: nombreSchema,
  dni: dniSchema,
  telefono: telefonoSchema,
  email: emailSchema,
  titulo: tituloSchema,
  matricula: matriculaSchema,
  capacidad: capacidadSchema,
}

export const profesorFormSchema = z.object(camposProfesor)

export type ProfesorFormValues = z.input<typeof profesorFormSchema>

export const PROFESOR_FORM_FIELDS = Object.keys(
  profesorFormSchema.shape,
) as (keyof ProfesorFormValues)[]

// Alta: los mismos campos más la contraseña inicial y su confirmación (T-07: entre 8 y 128
// caracteres, igual que valida la API).
export const profesorCrearFormSchema = z
  .object({
    ...camposProfesor,
    password: passwordSchema,
    confirmarPassword: passwordSchema,
  })
  .refine((datos) => datos.password === datos.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  })

export type ProfesorCrearFormValues = z.input<typeof profesorCrearFormSchema>

/** Campos que la API puede marcar con un 400 al crear (incluye `password`, que no edita). */
export const PROFESOR_CREAR_FORM_FIELDS = [
  ...PROFESOR_FORM_FIELDS,
  'password',
] as const satisfies readonly string[]

export const PROFESOR_FORM_VACIO: ProfesorFormValues = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  titulo: '',
  matricula: '',
  capacidad: '',
}

export const PROFESOR_CREAR_FORM_VACIO: ProfesorCrearFormValues = {
  ...PROFESOR_FORM_VACIO,
  password: '',
  confirmarPassword: '',
}

/** `profesorId` de la URL como número, o `null` si no es un entero positivo (se muestra 404). */
export function parsearProfesorId(profesorId: string): number | null {
  const id = Number(profesorId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Convierte el detalle de la API a valores del formulario de edición (sin contraseña). */
export function detalleAValoresForm(detalle: ProfesorDetalle): ProfesorFormValues {
  return {
    nombre: detalle.nombre,
    apellido: detalle.apellido,
    dni: detalle.dni,
    telefono: detalle.telefono,
    email: detalle.email,
    titulo: detalle.titulo,
    matricula: detalle.matricula,
    capacidad: String(detalle.capacidad),
  }
}

/** Convierte los valores del formulario de alta al body del POST. */
export function valoresFormACrear(valores: ProfesorCrearFormValues): ProfesorCrear {
  return {
    nombre: valores.nombre,
    apellido: valores.apellido,
    dni: valores.dni,
    telefono: valores.telefono,
    email: valores.email,
    titulo: valores.titulo,
    matricula: valores.matricula,
    capacidad: Number(valores.capacidad),
    password: valores.password,
  }
}

/**
 * Convierte los valores del formulario de edición al body del PATCH: solo los campos modificados.
 * Devuelve `null` si no hay cambios.
 */
export function valoresFormAEditar(
  valores: ProfesorFormValues,
  dirtyFields: Partial<Record<keyof ProfesorFormValues, boolean>>,
): ProfesorEditar | null {
  const cambios: ProfesorEditar = {}
  let hayCambios = false

  for (const key of PROFESOR_FORM_FIELDS) {
    if (!dirtyFields[key]) continue
    hayCambios = true
    if (key === 'capacidad') {
      cambios.capacidad = Number(valores.capacidad)
    } else {
      cambios[key] = valores[key]
    }
  }

  return hayCambios ? cambios : null
}

// ---------- Horario (bloques) ----------

// Solo formato, el mismo del contrato (docs/contrato-api.md → Formatos): día ISO 1 a 7 y horas
// `HH:mm` en punto. Superposición, aula ocupada y el estado del profesor los decide la API.
const DIA_SEMANA_FORMATO = /^[1-7]$/
const HORA_EN_PUNTO = /^([01]\d|2[0-3]):00$/

const horaEnPuntoSchema = z
  .string({ message: 'Campo obligatorio' })
  .min(1, { message: 'Campo obligatorio' })
  .regex(HORA_EN_PUNTO, { message: 'Debe ser una hora en punto (por ejemplo 14:00)' })

/**
 * Formulario de alta y edición de bloques. Los selects trabajan con texto: `diaSemana` y `aulaId`
 * se convierten a número al armar el body. En la edición `horaFin` no se elige: es `horaInicio`
 * más una hora (cada fila dura una hora, T-29), y el formulario la completa sola.
 */
export const bloqueFormSchema = z
  .object({
    diaSemana: z
      .string({ message: 'Elegí un día' })
      .regex(DIA_SEMANA_FORMATO, { message: 'Elegí un día' }),
    horaInicio: horaEnPuntoSchema,
    horaFin: horaEnPuntoSchema,
    aulaId: z.string({ message: 'Elegí un aula' }).min(1, { message: 'Elegí un aula' }),
  })
  .refine(
    // `HH:mm` con dos dígitos: la comparación de textos es la de horas.
    (datos) =>
      !HORA_EN_PUNTO.test(datos.horaInicio) ||
      !HORA_EN_PUNTO.test(datos.horaFin) ||
      datos.horaFin > datos.horaInicio,
    { message: 'La hora de fin debe ser posterior a la de inicio', path: ['horaFin'] },
  )

export type BloqueFormValues = z.input<typeof bloqueFormSchema>

export const BLOQUE_FORM_VACIO: BloqueFormValues = {
  diaSemana: '',
  horaInicio: '',
  horaFin: '',
  aulaId: '',
}

/** Valores del formulario de edición a partir de la fila del horario. */
export function bloqueAValoresForm(bloque: Bloque): BloqueFormValues {
  return {
    diaSemana: String(bloque.diaSemana),
    horaInicio: bloque.horaInicio,
    horaFin: bloque.horaFin,
    aulaId: String(bloque.aula.id),
  }
}

/** Body del alta (sin `profesorId`: lo agrega el hook). */
export function valoresFormACrearBloque(
  valores: BloqueFormValues,
): Omit<BloqueCrear, 'profesorId'> {
  return {
    diaSemana: Number(valores.diaSemana),
    horaInicio: valores.horaInicio,
    horaFin: valores.horaFin,
    aulaId: Number(valores.aulaId),
  }
}

/**
 * Body del PATCH de una hora: solo lo que cambió respecto de la fila actual. Si cambia el horario
 * van las dos horas (la API valida que sigan formando una hora exacta). `null` si no hay cambios.
 */
export function valoresFormAEditarBloque(
  valores: BloqueFormValues,
  actual: Bloque,
): BloqueEditar | null {
  const cambios: BloqueEditar = {}
  const diaSemana = Number(valores.diaSemana)
  const aulaId = Number(valores.aulaId)

  if (diaSemana !== actual.diaSemana) cambios.diaSemana = diaSemana
  if (valores.horaInicio !== actual.horaInicio || valores.horaFin !== actual.horaFin) {
    cambios.horaInicio = valores.horaInicio
    cambios.horaFin = valores.horaFin
  }
  if (aulaId !== actual.aula.id) cambios.aulaId = aulaId

  return Object.keys(cambios).length > 0 ? cambios : null
}

/**
 * `bloque` de la URL de la sección "Horario" (`?tab=horario&bloque=…`): `'nuevo'` abre el alta y
 * un entero positivo, la edición de esa hora. Cualquier otro valor, ningún formulario.
 */
export function parsearParamBloque(valor: string | null): 'nuevo' | number | null {
  if (valor === 'nuevo') return 'nuevo'
  const id = Number(valor)
  return valor && Number.isInteger(id) && id > 0 ? id : null
}
