import type { AgendaListado, AgendaPropiaListado } from './agendas.validation'

// Ejemplos del OpenAPI de las agendas (Swagger en /api/v1/docs), usados en agendas.routes. Solo
// datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploAgendaDiaria = {
  data: [
    {
      id: 15,
      alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
      profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
      materia: { id: 2, nombre: 'Matemática' },
      aula: { id: 1, nombre: 'Aula 1' },
      horaInicio: '09:00',
      horaFin: '10:00',
      estado: 'ACTIVO',
    },
  ],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
} satisfies AgendaListado

// Una semana de la agenda propia: el recurrente de los lunes 9–10 y una sesión única del martes.
export const ejemploAgendaPropia = [
  {
    turnoId: 31,
    fecha: '2026-09-28',
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    tipo: 'RECURRENTE',
    estado: 'ACTIVO',
  },
  {
    turnoId: 44,
    fecha: '2026-09-29',
    diaSemana: 2,
    horaInicio: '11:00',
    horaFin: '12:00',
    alumno: { id: 18, apellido: 'Sosa', nombre: 'Martín' },
    materia: { id: 7, nombre: 'Física' },
    aula: { id: 1, nombre: 'Aula 1' },
    tipo: 'SESION_UNICA',
    estado: 'ACTIVO',
  },
] satisfies AgendaPropiaListado

export const ejemploMateriasConTurno = [
  { id: 2, nombre: 'Matemática' },
  { id: 7, nombre: 'Física' },
]

export const ejemploAulasConTurno = [
  { id: 1, nombre: 'Aula 1' },
  { id: 2, nombre: 'Aula 2' },
]
