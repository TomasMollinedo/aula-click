import type { ErrorResponse } from '@/server/errors'
import type {
  CrearMateria,
  EditarMateria,
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
  precioHora: 8000.5,
} satisfies CrearMateria

export const ejemploEdicion = { precioHora: 8500 } satisfies EditarMateria

export const ejemploListadoItem = {
  id: 3,
  nombre: 'Matemática',
  estado: 'ACTIVO',
  precioHora: 8000.5,
  sinPrecio: false,
} satisfies MateriaListadoItem

export const ejemploListado = {
  data: [
    { id: 5, nombre: 'Física', estado: 'ACTIVO', precioHora: 8000, sinPrecio: false },
    // Anterior a HU-12: quedó inactiva y sin precio hasta que el gerente se lo cargue.
    { id: 7, nombre: 'Latín', estado: 'INACTIVO', precioHora: null, sinPrecio: true },
    ejemploListadoItem,
  ],
  meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
} satisfies MateriasListado

export const ejemploSelector = [
  { id: 5, nombre: 'Física' },
  { id: 3, nombre: 'Matemática' },
] satisfies MateriaSelectorItem[]

const ejemploProfesor = {
  id: 8,
  apellido: 'Gómez',
  nombre: 'Luis',
  estado: 'ACTIVO',
} satisfies MateriaProfesor

export const ejemploDetalle = {
  id: 3,
  nombre: ejemploAlta.nombre,
  descripcion: ejemploAlta.descripcion,
  estado: 'ACTIVO',
  precioHora: 8000.5,
  sinPrecio: false,
  profesores: [ejemploProfesor],
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-23T10:02:17.000Z',
  createdBy: { id: 'usr_gerente_01', nombre: 'Laura', apellido: 'Díaz' },
  updatedBy: { id: 'usr_gerente_01', nombre: 'Laura', apellido: 'Díaz' },
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

/** 409 del service: reactivar una materia que todavía no tiene precio. */
export const ejemploErrorSinPrecio = {
  error: {
    code: 'MATERIA_SIN_PRECIO',
    message: 'La materia no tiene precio: cárguelo antes de reactivarla',
  },
} satisfies ErrorResponse
