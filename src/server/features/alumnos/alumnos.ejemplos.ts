import type { ErrorResponse } from '@/server/errors'
import type {
  AlumnoDeProfesorItem,
  AlumnoDetalle,
  AlumnoListadoItem,
  AlumnosDeProfesorListado,
  AlumnosListado,
  CrearAlumno,
  EditarAlumno,
  MiPerfil,
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
  telefono: '387154123456',
} satisfies CrearAlumno

/** Alta de un menor: los obligatorios más nombre, apellido, teléfono y email del tutor. */
export const ejemploAltaMenor = {
  nombre: 'Lucía',
  apellido: 'Álvarez',
  dni: '52345678',
  fechaNacimiento: '2012-03-08',
  email: 'lucia.alvarez@mail.com',
  telefono: '387155001122',
  nivelEscolaridad: 'SECUNDARIO',
  grado: '2° año',
  institucionEducativa: 'Colegio Nacional de Salta',
  tutorNombre: 'Marta',
  tutorApellido: 'Álvarez',
  tutorTelefono: '387154339876',
  tutorEmail: 'marta.alvarez@mail.com',
} satisfies CrearAlumno

export const ejemploEdicion = {
  telefono: '387154987654',
  observaciones: null,
} satisfies EditarAlumno

export const ejemploListadoItem = {
  id: 12,
  apellido: 'Álvarez',
  nombre: 'Lucía',
  dni: '52345678',
  fotoUrl: 'https://minio.local/alumnos/12/foto.jpg?X-Amz-Signature=…',
} satisfies AlumnoListadoItem

export const ejemploListado = {
  data: [
    ejemploListadoItem,
    { id: 7, apellido: 'González', nombre: 'Juan', dni: '30123456', fotoUrl: null },
  ],
  meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
} satisfies AlumnosListado

export const ejemploDeProfesorItem = {
  id: 12,
  apellido: 'Álvarez',
  nombre: 'Lucía',
  dni: '52345678',
  fotoUrl: 'https://minio.local/alumnos/12/foto.jpg?X-Amz-Signature=…',
  materias: [{ id: 2, nombre: 'Matemática' }],
} satisfies AlumnoDeProfesorItem

export const ejemploMisAlumnos = {
  data: [
    ejemploDeProfesorItem,
    {
      id: 7,
      apellido: 'González',
      nombre: 'Juan',
      dni: '30123456',
      fotoUrl: null,
      materias: [
        { id: 2, nombre: 'Matemática' },
        { id: 7, nombre: 'Física' },
      ],
    },
  ],
  meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
} satisfies AlumnosDeProfesorListado

export const ejemploDetalle = {
  id: 12,
  ...ejemploAltaMenor,
  tutorDni: null,
  observaciones: null,
  estado: 'ACTIVO',
  menorDeEdad: true,
  fotoUrl: 'https://minio.local/alumnos/12/foto.jpg?X-Amz-Signature=…',
  acceso: {
    usuario: 'lalvarez678',
    creadoPor: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
    creadoEl: '2026-09-22T13:45:00.000Z',
    restablecidaPor: null,
    restablecidaEl: null,
  },
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-23T10:02:17.000Z',
  createdBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
  updatedBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
} satisfies AlumnoDetalle

/** Perfil del alumno de la sesión (HU-28): sólo lo que el menú del portal necesita. */
export const ejemploMiPerfil = {
  nombre: 'Lucía',
  apellido: 'Álvarez',
  usuario: 'lalvarez678',
  fotoUrl: 'https://minio.local/alumnos/12/foto.jpg?X-Amz-Signature=…',
} satisfies MiPerfil

/** 400 del schema: la foto no es JPG ni PNG (o su contenido no coincide con el tipo). */
export const ejemploErrorFoto = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [{ path: ['foto'], message: 'La foto debe ser JPG o PNG' }],
  },
} satisfies ErrorResponse

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
