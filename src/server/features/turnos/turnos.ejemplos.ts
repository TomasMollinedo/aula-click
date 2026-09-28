import type { ErrorResponse } from '@/server/errors'
import type {
  AgendaPropiaListado,
  CrearTurno,
  DisponibilidadItem,
  TurnoDetalle,
  TurnosAlta,
} from './turnos.validation'

// Ejemplos del OpenAPI de turnos (Swagger en /api/v1/docs), usados en turnos.routes. Solo datos:
// sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploDisponibilidad = [
  {
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    diaSemana: 1,
    fecha: '2026-09-28',
    aula: { id: 3, nombre: 'Aula 3' },
    horaInicio: '08:00',
    horaFin: '10:00',
    horas: [
      {
        bloqueId: 10,
        horaInicio: '08:00',
        horaFin: '09:00',
        capacidadEfectiva: 6,
        ocupacion: 6,
        lleno: true,
      },
      {
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        capacidadEfectiva: 6,
        ocupacion: 2,
        lleno: false,
      },
    ],
  },
] satisfies DisponibilidadItem[]

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

export const ejemploAltaRecurrente = {
  alumnoId: 12,
  materiaId: 3,
  bloqueIds: [11],
  tipo: 'RECURRENTE',
  fechaInicio: '2026-10-05',
  fechaFin: '2026-11-30',
  motivoConsulta: 'Repaso de funciones',
  asignarDondeHayLugar: false,
} satisfies CrearTurno

export const ejemploAltaSesionUnica = {
  alumnoId: 12,
  materiaId: 3,
  bloqueIds: [10, 12],
  tipo: 'SESION_UNICA',
  fechaInicio: '2026-10-05',
  asignarDondeHayLugar: false,
} satisfies CrearTurno

export const ejemploDetalle = {
  id: 55,
  tipo: 'RECURRENTE',
  estado: 'ACTIVO',
  fechaInicio: '2026-10-05',
  fechaFin: '2026-10-19',
  diaSemana: 1,
  horaInicio: '09:00',
  horaFin: '10:00',
  bloqueId: 11,
  alumno: { id: 12, nombre: 'Lucía', apellido: 'González', dni: '40123456' },
  profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
  materia: { id: 3, nombre: 'Matemática' },
  aula: { id: 3, nombre: 'Aula 3' },
  motivoConsulta: 'Repaso de funciones',
  createdAt: '2026-09-24T13:45:00.000Z',
  updatedAt: '2026-09-24T13:45:00.000Z',
  createdBy: { id: 'usr_mesa_01', nombre: 'Laura', apellido: 'Gómez' },
  updatedBy: { id: 'usr_mesa_01', nombre: 'Laura', apellido: 'Gómez' },
} satisfies TurnoDetalle

/** Alta de un recurrente con `asignarDondeHayLugar`: dos tramos que saltean el 26/10. */
export const ejemploAltaEnTramos = {
  cantidad: 2,
  turnos: [
    ejemploDetalle,
    { ...ejemploDetalle, id: 56, fechaInicio: '2026-11-02', fechaFin: '2026-11-30' },
  ],
  fechasSinTurno: [
    {
      bloqueId: 11,
      horaInicio: '09:00',
      horaFin: '10:00',
      fechas: ['2026-10-26'],
      completoDesde: null,
    },
  ],
} satisfies TurnosAlta

export const ejemploErrorBloqueLleno = {
  error: {
    code: 'BLOQUE_LLENO',
    message:
      'Hay fechas sin lugar: se puede asignar el turno solo en las fechas con lugar, o cancelar',
    details: [
      {
        path: ['bloqueIds', 0],
        message: 'La hora de 9:00 a 10:00 está completa el lunes 26/10',
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        capacidadEfectiva: 6,
        fechas: ['2026-10-26'],
        completoDesde: null,
        sinLugar: false,
      },
    ],
  },
} satisfies ErrorResponse

export const ejemploErrorAlumnoSuperpuesto = {
  error: {
    code: 'ALUMNO_SUPERPUESTO',
    message: 'El alumno ya tiene un turno en ese horario',
    details: [
      {
        turnoId: 40,
        tipo: 'RECURRENTE',
        fechaInicio: '2026-09-28',
        fechaFin: null,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        profesor: { id: 7, nombre: 'Sofía', apellido: 'Herrera' },
        materia: { id: 5, nombre: 'Física' },
      },
    ],
  },
} satisfies ErrorResponse

export const ejemploErrorFechaFueraDelDia = {
  error: {
    code: 'VALIDACION',
    message: 'La fecha debe caer en lunes',
    details: [{ path: ['fechaInicio'], message: 'La fecha debe caer en lunes' }],
  },
} satisfies ErrorResponse
