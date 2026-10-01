import type { AgendaCentroListado, AgendaListado, AgendaPropiaListado } from './agendas.validation'

// Ejemplos del OpenAPI de las agendas (Swagger en /api/v1/docs), usados en agendas.routes. Solo
// datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploAgendaDiaria = {
  data: [
    {
      turnoId: 15,
      fecha: '2026-09-28',
      bloqueAgendaId: 8,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '10:00',
      alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
      profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
      materia: { id: 2, nombre: 'Matemática' },
      aula: { id: 1, nombre: 'Aula 1' },
      tipo: 'RECURRENTE',
      estado: 'AGENDADO',
      estadoPago: 'PENDIENTE',
      prioridad: 'ALTA',
      examen: {
        id: 5,
        fecha: '2026-10-02',
        tipo: 'PARCIAL',
        materiaNombre: 'Matemática',
        dias: 4,
      },
    },
    {
      turnoId: 16,
      fecha: '2026-09-28',
      bloqueAgendaId: 8,
      diaSemana: 1,
      horaInicio: '09:00',
      horaFin: '10:00',
      alumno: { id: 18, apellido: 'Sosa', nombre: 'Martín' },
      profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
      materia: { id: 2, nombre: 'Matemática' },
      aula: { id: 1, nombre: 'Aula 1' },
      tipo: 'SESION_UNICA',
      estado: 'CANCELADO',
      estadoPago: 'PENDIENTE',
      prioridad: null,
      examen: null,
    },
  ],
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
} satisfies AgendaListado

// Una semana de la agenda propia: el recurrente de los lunes 9–10 (ya pagado el primero, con
// examen cerca) y una sesión única del martes sin examen.
export const ejemploAgendaPropia = [
  {
    turnoId: 31,
    fecha: '2026-09-28',
    bloqueAgendaId: 8,
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    estadoPago: 'PAGADO',
    prioridad: 'ALTA',
    examen: {
      id: 5,
      fecha: '2026-10-02',
      tipo: 'PARCIAL',
      materiaNombre: 'Matemática',
      dias: 4,
    },
  },
  {
    turnoId: 44,
    fecha: '2026-09-29',
    bloqueAgendaId: 12,
    diaSemana: 2,
    horaInicio: '11:00',
    horaFin: '12:00',
    alumno: { id: 18, apellido: 'Sosa', nombre: 'Martín' },
    materia: { id: 7, nombre: 'Física' },
    aula: { id: 1, nombre: 'Aula 1' },
    tipo: 'SESION_UNICA',
    estado: 'AGENDADO',
    estadoPago: 'PENDIENTE',
    prioridad: 'BAJA',
    examen: null,
  },
] satisfies AgendaPropiaListado

// Una clase de dos alumnos (mismo bloque y fecha) de la agenda del centro: uno agendado y otro
// cancelado. El cliente las agrupa por `fecha` + `bloqueAgendaId`.
export const ejemploAgendaCentro = [
  {
    turnoId: 31,
    fecha: '2026-09-28',
    bloqueAgendaId: 8,
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
    profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    estadoPago: 'PENDIENTE',
    prioridad: 'MEDIA',
    examen: {
      id: 6,
      fecha: '2026-10-12',
      tipo: 'FINAL',
      materiaNombre: 'Matemática',
      dias: 14,
    },
  },
  {
    turnoId: 40,
    fecha: '2026-09-28',
    bloqueAgendaId: 8,
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    alumno: { id: 18, apellido: 'Sosa', nombre: 'Martín' },
    profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 3, nombre: 'Aula 3' },
    tipo: 'SESION_UNICA',
    estado: 'CANCELADO',
    estadoPago: 'PENDIENTE',
    prioridad: null,
    examen: null,
  },
] satisfies AgendaCentroListado

export const ejemploMateriasConTurno = [
  { id: 2, nombre: 'Matemática' },
  { id: 7, nombre: 'Física' },
]

export const ejemploAulasConTurno = [
  { id: 1, nombre: 'Aula 1' },
  { id: 2, nombre: 'Aula 2' },
]
