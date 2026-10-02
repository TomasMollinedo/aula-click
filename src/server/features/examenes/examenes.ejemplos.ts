import type { ErrorResponse } from '@/server/errors'
import type {
  CrearExamen,
  EditarExamen,
  ExamenDetalle,
  ExamenesListado,
  ExamenItem,
  MateriasExamenSelector,
} from './examenes.validation'

// Ejemplos del OpenAPI de exámenes (Swagger en /api/v1/docs), usados en examenes.routes. Solo
// datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploAlta = {
  alumnoId: 12,
  materiaId: 3,
  fecha: '2026-10-15',
  tipo: 'PARCIAL',
  observaciones: 'Trae calculadora y formulario',
} satisfies CrearExamen

export const ejemploEdicion = { fecha: '2026-10-22' } satisfies EditarExamen

const ejemploAuditoriaMesa = {
  id: 'usr_mesa_01',
  nombre: 'Ana',
  apellido: 'Pérez',
  role: 'MESA_ENTRADAS',
} as const

const ejemploAuditoriaProfesor = {
  id: 'usr_prof_01',
  nombre: 'Luis',
  apellido: 'Gómez',
  role: 'PROFESOR',
} as const

export const ejemploItemProximo = {
  id: 5,
  materia: { id: 3, nombre: 'Matemática' },
  fecha: '2026-10-15',
  tipo: 'PARCIAL',
  observaciones: 'Trae calculadora y formulario',
  pasado: false,
  diasRestantes: 10,
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-22T13:45:00.000Z',
  createdBy: ejemploAuditoriaProfesor,
  updatedBy: ejemploAuditoriaProfesor,
} satisfies ExamenItem

const ejemploItemPasado = {
  id: 2,
  materia: { id: 5, nombre: 'Física' },
  fecha: '2026-08-01',
  tipo: 'FINAL',
  observaciones: null,
  pasado: true,
  diasRestantes: null,
  createdAt: '2026-07-10T09:00:00.000Z',
  updatedAt: '2026-07-10T09:00:00.000Z',
  createdBy: ejemploAuditoriaMesa,
  updatedBy: ejemploAuditoriaMesa,
} satisfies ExamenItem

export const ejemploListado = {
  proximos: [ejemploItemProximo],
  pasados: [ejemploItemPasado],
} satisfies ExamenesListado

export const ejemploDetalle = {
  id: 5,
  alumnoId: 12,
  materia: { id: 3, nombre: 'Matemática' },
  fecha: '2026-10-15',
  tipo: 'PARCIAL',
  observaciones: 'Trae calculadora y formulario',
  pasado: false,
  createdAt: '2026-09-22T13:45:00.000Z',
  updatedAt: '2026-09-22T13:45:00.000Z',
  createdBy: ejemploAuditoriaProfesor,
  updatedBy: ejemploAuditoriaProfesor,
} satisfies ExamenDetalle

export const ejemploSelector = [
  { id: 3, nombre: 'Matemática' },
  { id: 5, nombre: 'Física' },
] satisfies MateriasExamenSelector

/** 409 del service: ya hay un examen pendiente de esa materia. */
export const ejemploErrorPendiente = {
  error: {
    code: 'EXAMEN_PENDIENTE',
    message: 'Ya hay un examen pendiente de esa materia: edítelo en vez de cargar uno nuevo',
    details: { id: 5, tipo: 'PARCIAL', fecha: '2026-10-15' },
  },
} satisfies ErrorResponse

/** 409 del service: la materia está inactiva. */
export const ejemploErrorMateriaInactiva = {
  error: {
    code: 'MATERIA_INACTIVA',
    message: 'La materia está inactiva: no se le puede cargar un examen',
    details: [
      { path: ['materiaId'], message: 'La materia está inactiva: no se le puede cargar un examen' },
    ],
  },
} satisfies ErrorResponse
