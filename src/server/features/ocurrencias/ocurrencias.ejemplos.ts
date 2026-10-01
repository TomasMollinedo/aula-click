import type { OcurrenciaDelAlumnoItem, OcurrenciaDetalle } from './ocurrencias.validation'

// Ejemplos del OpenAPI de `ocurrencias` (Swagger en /api/v1/docs), usados en ocurrencias.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

const auditoria = {
  createdAt: '2026-08-01T13:00:00.000Z',
  createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
  updatedAt: '2026-08-01T13:00:00.000Z',
  updatedBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez' },
}

export const ejemploOcurrenciaDetalle = {
  turnoId: 31,
  fecha: '2026-09-28',
  alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
  materia: { id: 3, nombre: 'Matemática' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Pérez' },
  aula: { id: 3, nombre: 'Aula 3' },
  horaInicio: '09:00',
  horaFin: '10:00',
  tipo: 'RECURRENTE',
  serie: { fechaInicio: '2026-03-02', fechaFin: null, finalizacion: null },
  estado: 'AGENDADO',
  observaciones: null,
  temas: null,
  cancelacion: null,
  prioridad: 'ALTA',
  examen: {
    id: 8,
    fecha: '2026-10-05',
    tipo: 'PARCIAL',
    materiaNombre: 'Matemática',
    dias: 7,
  },
  acciones: {
    cancelar: { visible: true, habilitada: true },
    finalizar: { visible: true },
    reprogramar: { visible: true },
    registrarPago: { visible: true },
  },
  ...auditoria,
} satisfies OcurrenciaDetalle

export const ejemploOcurrenciasDelAlumno = [
  {
    turnoId: 31,
    fecha: '2026-09-28',
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    profesor: { id: 3, nombre: 'Ana', apellido: 'Pérez' },
    materia: { id: 3, nombre: 'Matemática' },
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    prioridad: 'ALTA',
    cancelable: true,
  },
  {
    turnoId: 44,
    fecha: '2026-09-29',
    diaSemana: 2,
    horaInicio: '11:00',
    horaFin: '12:00',
    profesor: { id: 7, nombre: 'Martín', apellido: 'Sosa' },
    materia: { id: 7, nombre: 'Física' },
    tipo: 'SESION_UNICA',
    estado: 'CANCELADO',
    prioridad: null,
    cancelable: false,
  },
] satisfies OcurrenciaDelAlumnoItem[]
