import type { ErrorResponse } from '@/server/errors'
import type {
  CrearMiTurno,
  CrearTurno,
  DisponibilidadItem,
  Habilitacion,
  MateriaOfertada,
  MiDisponibilidadItem,
  TurnoDetalle,
  TurnoReservado,
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

export const ejemploAltaRecurrente = {
  alumnoId: 12,
  materiaId: 3,
  bloqueIds: [11],
  tipo: 'RECURRENTE',
  fechaInicio: '2026-10-05',
  fechaFin: '2026-11-30',
  observaciones: 'Repaso de funciones',
  temas: 'Funciones cuadráticas',
  asignarDondeHayLugar: false,
} satisfies CrearTurno

export const ejemploAltaSesionUnica = {
  alumnoId: 12,
  materiaId: 3,
  bloqueIds: [10, 12],
  tipo: 'SESION_UNICA',
  fechaInicio: '2026-10-05',
  temas: 'Repaso general antes del examen',
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
  observaciones: 'Repaso de funciones',
  temas: 'Funciones cuadráticas',
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

export const ejemploErrorDeudaVencida = {
  error: {
    code: 'DEUDA_VENCIDA',
    message:
      'El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos',
    details: { cantidad: 3, total: 24000 },
  },
} satisfies ErrorResponse

// ---------------------------------------------------------------------------------------------
// Portal del alumno (HU-29)
// ---------------------------------------------------------------------------------------------

export const ejemploHabilitacion = {
  habilitado: false,
  deuda: { cantidad: 3, total: 24000 },
} satisfies Habilitacion

export const ejemploMisMaterias = [
  { id: 5, nombre: 'Física' },
  { id: 3, nombre: 'Matemática' },
] satisfies MateriaOfertada[]

export const ejemploMiDisponibilidad = [
  {
    profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
    diaSemana: 1,
    fecha: '2026-09-28',
    aula: { id: 3, nombre: 'Aula 3' },
    horaInicio: '08:00',
    horaFin: '10:00',
    valorPorClase: 8000,
    horas: [
      { bloqueId: 10, horaInicio: '08:00', horaFin: '09:00', disponible: false },
      { bloqueId: 11, horaInicio: '09:00', horaFin: '10:00', disponible: true },
    ],
  },
] satisfies MiDisponibilidadItem[]

export const ejemploMiAltaRecurrente = {
  materiaId: 3,
  bloqueIds: [11],
  tipo: 'RECURRENTE',
  fechaInicio: '2026-10-05',
  fechaFin: null,
  temas: 'Funciones cuadráticas',
  asignarDondeHayLugar: false,
} satisfies CrearMiTurno

export const ejemploMiAltaSesionUnica = {
  materiaId: 3,
  bloqueIds: [11],
  tipo: 'SESION_UNICA',
  fechaInicio: '2026-10-05',
  temas: 'Repaso antes del examen',
  asignarDondeHayLugar: false,
} satisfies CrearMiTurno

export const ejemploTurnoReservado = {
  cantidad: 2,
  tipo: 'RECURRENTE',
  diaSemana: 1,
  materia: { id: 3, nombre: 'Matemática' },
  profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
  aula: { id: 3, nombre: 'Aula 3' },
  temas: 'Funciones cuadráticas',
  turnos: [
    {
      id: 55,
      bloqueId: 11,
      horaInicio: '09:00',
      horaFin: '10:00',
      fechaInicio: '2026-10-05',
      fechaFin: '2026-10-19',
    },
    {
      id: 56,
      bloqueId: 11,
      horaInicio: '09:00',
      horaFin: '10:00',
      fechaInicio: '2026-11-02',
      fechaFin: null,
    },
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
} satisfies TurnoReservado

export const ejemploErrorDesdeManana = {
  error: {
    code: 'VALIDACION',
    message: 'Los turnos se sacan desde el día siguiente',
    details: [{ path: ['fechaInicio'], message: 'Los turnos se sacan desde el día siguiente' }],
  },
} satisfies ErrorResponse

export const ejemploErrorMiDeudaVencida = {
  error: {
    code: 'DEUDA_VENCIDA',
    message:
      'Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada',
    details: { cantidad: 3, total: 24000 },
  },
} satisfies ErrorResponse

export const ejemploErrorMiSuperposicion = {
  error: {
    code: 'ALUMNO_SUPERPUESTO',
    message: 'Ya tenés un turno ese día en ese horario',
    details: ejemploErrorAlumnoSuperpuesto.error.details,
  },
} satisfies ErrorResponse

export const ejemploErrorMiBloqueLleno = {
  error: {
    code: 'BLOQUE_LLENO',
    message: ejemploErrorBloqueLleno.error.message,
    // Las mismas fechas que la mesa, sin la capacidad efectiva de la hora (el alumno no ve cupos).
    details: [
      {
        path: ['bloqueIds', 0],
        message: 'La hora de 9:00 a 10:00 está completa el lunes 26/10',
        bloqueId: 11,
        horaInicio: '09:00',
        horaFin: '10:00',
        fechas: ['2026-10-26'],
        completoDesde: null,
        sinLugar: false,
      },
    ],
  },
} satisfies ErrorResponse
