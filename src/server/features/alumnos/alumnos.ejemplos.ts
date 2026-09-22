import type { ErrorResponse } from '@/server/errors'
import type {
  AlumnoDetalle,
  AlumnoListadoItem,
  AlumnosListado,
  CrearAlumno,
  EditarAlumno,
} from './alumnos.validation'

// Ejemplos del OpenAPI de alumnos (Swagger en /api/v1/docs), usados en alumnos.routes. Solo datos:
// sin lógica. `satisfies` los mantiene alineados con los schemas.

/** Alta mínima de un adulto: solo los seis obligatorios. */
export const ejemploAltaAdulto = {
  nombre: 'Juan',
  apellido: 'González',
  dni: '30123456',
  fechaNacimiento: '1990-05-14',
  email: 'juan.gonzalez@mail.com',
  telefono: '(387) 15-412-3456',
} satisfies CrearAlumno

/** Alta de un menor: los obligatorios más nombre, apellido, teléfono y email del tutor. */
export const ejemploAltaMenor = {
  nombre: 'Lucía',
  apellido: 'Álvarez',
  dni: '52345678',
  fechaNacimiento: '2012-03-08',
  email: 'lucia.alvarez@mail.com',
  telefono: '(387) 15-500-1122',
  nivelEscolaridad: 'SECUNDARIO',
  grado: '2° año',
  institucionEducativa: 'Colegio Nacional de Salta',
  tutorNombre: 'Marta',
  tutorApellido: 'Álvarez',
  tutorTelefono: '(387) 15-433-9876',
  tutorEmail: 'marta.alvarez@mail.com',
} satisfies CrearAlumno

export const ejemploEdicion = {
  telefono: '(387) 15-498-7654',
  observaciones: null,
} satisfies EditarAlumno

export const ejemploListadoItem = {
  id: 12,
  apellido: 'Álvarez',
  nombre: 'Lucía',
} satisfies AlumnoListadoItem

export const ejemploListado = {
  data: [ejemploListadoItem, { id: 7, apellido: 'González', nombre: 'Juan' }],
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
} satisfies AlumnosListado

export const ejemploDetalle = {
  id: 12,
  ...ejemploAltaMenor,
  tutorDni: null,
  observaciones: null,
  estado: 'ACTIVO',
  menorDeEdad: true,
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-23T10:02:17.000Z',
  createdBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
  updatedBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
} satisfies AlumnoDetalle

/** 400 del service: alta de un menor sin los datos del tutor. */
export const ejemploErrorTutor = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [
      { path: ['tutorNombre'], message: 'Obligatorio para menores de edad' },
      { path: ['tutorApellido'], message: 'Obligatorio para menores de edad' },
      { path: ['tutorTelefono'], message: 'Obligatorio para menores de edad' },
      { path: ['tutorEmail'], message: 'Obligatorio para menores de edad' },
    ],
  },
} satisfies ErrorResponse

/** 409 del repository: DNI repetido en el alta o en la edición. */
export const ejemploErrorDni = {
  error: {
    code: 'CONFLICTO',
    message: 'Ya existe un alumno con ese DNI',
    details: [{ path: ['dni'], message: 'Ya existe un alumno con ese DNI' }],
  },
} satisfies ErrorResponse
