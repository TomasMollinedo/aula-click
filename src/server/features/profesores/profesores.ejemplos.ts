import type { ErrorResponse } from '@/server/errors'
import type {
  CrearProfesor,
  EditarProfesor,
  ProfesorDetalle,
  ProfesorListadoItem,
  ProfesoresListado,
} from './profesores.validation'

// Ejemplos del OpenAPI de profesores (Swagger en /api/v1/docs), usados en profesores.routes. Solo
// datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploAlta = {
  nombre: 'Martín',
  apellido: 'Pérez',
  dni: '28333444',
  telefono: '3874333444',
  email: 'martin.perez@aulaclick.local',
  titulo: 'Profesor en Matemática',
  matricula: 'MP-0001',
  capacidad: 5,
  password: 'inicial-2026',
} satisfies CrearProfesor

export const ejemploEdicion = {
  telefono: '3874111000',
  titulo: 'Profesor en Física y Matemática',
} satisfies EditarProfesor

export const ejemploListadoItem = {
  id: 3,
  apellido: 'Pérez',
  nombre: 'Martín',
  estado: 'ACTIVO',
  fotoUrl: null,
} satisfies ProfesorListadoItem

export const ejemploListado = {
  data: [ejemploListadoItem],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
} satisfies ProfesoresListado

export const ejemploDetalle = {
  id: 3,
  nombre: 'Martín',
  apellido: 'Pérez',
  dni: '28333444',
  telefono: '3874333444',
  email: 'martin.perez@aulaclick.local',
  titulo: 'Profesor en Matemática',
  matricula: 'MP-0001',
  capacidad: 5,
  estado: 'ACTIVO',
  fotoUrl: null,
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-23T10:02:17.000Z',
  createdBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
  updatedBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
} satisfies ProfesorDetalle

/** 409 del repository: DNI, email o matrícula repetidos (uno por pedido). */
export const ejemploErrorDni = {
  error: {
    code: 'CONFLICTO',
    message: 'Ya existe un profesor con ese DNI',
    details: [{ path: ['dni'], message: 'Ya existe un profesor con ese DNI' }],
  },
} satisfies ErrorResponse

/** 400 del schema: la foto no es JPG ni PNG, o supera el tamaño máximo. */
export const ejemploErrorFoto = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [{ path: ['foto'], message: 'La foto debe ser JPG o PNG' }],
  },
} satisfies ErrorResponse
