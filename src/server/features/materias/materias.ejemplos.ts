import type { ErrorResponse } from '@/server/errors'
import type {
  CrearMateria,
  MateriaDetalle,
  MateriaListadoItem,
  MateriaProfesor,
  MateriaSelectorItem,
  MateriasListado,
} from './materias.validation'

// Ejemplos del OpenAPI de materias (Swagger en /api/v1/docs), usados en materias.routes. Solo
// datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploAlta = {
  nombre: 'Matemática',
  descripcion: 'Álgebra y análisis para el ciclo básico',
} satisfies CrearMateria

export const ejemploListadoItem = {
  id: 3,
  nombre: 'Matemática',
  estado: 'ACTIVO',
} satisfies MateriaListadoItem

export const ejemploListado = {
  data: [{ id: 5, nombre: 'Física', estado: 'ACTIVO' }, ejemploListadoItem],
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
} satisfies MateriasListado

export const ejemploSelector = [
  { id: 5, nombre: 'Física' },
  ejemploListadoItem,
] satisfies MateriaSelectorItem[]

const ejemploProfesor = {
  id: 8,
  apellido: 'Gómez',
  nombre: 'Luis',
  estado: 'ACTIVO',
} satisfies MateriaProfesor

export const ejemploDetalle = {
  id: 3,
  ...ejemploAlta,
  estado: 'ACTIVO',
  profesores: [ejemploProfesor],
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-23T10:02:17.000Z',
  createdBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
  updatedBy: { id: 'usr_mesa_01', nombre: 'Ana', apellido: 'Pérez' },
} satisfies MateriaDetalle

/** 409 del repository: el nombre ya existe (la comparación no distingue mayúsculas ni tildes). */
export const ejemploErrorNombre = {
  error: {
    code: 'CONFLICTO',
    message: 'Ya existe una materia con ese nombre',
    details: [{ path: ['nombre'], message: 'Ya existe una materia con ese nombre' }],
  },
} satisfies ErrorResponse

/** 409 del service: la baja de una materia con asignaciones activas, con sus profesores. */
export const ejemploErrorConProfesores = {
  error: {
    code: 'MATERIA_CON_PROFESORES',
    message: 'No se puede dar de baja una materia con profesores asignados',
    details: [ejemploProfesor],
  },
} satisfies ErrorResponse
