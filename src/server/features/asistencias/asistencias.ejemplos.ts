import type {
  AsistenciasDelDia,
  AsistenciasPendientes,
  FilaAsistencia,
  RegistrarAsistencias,
} from './asistencias.validation'

// Ejemplos del OpenAPI de asistencias (HU-22): solo documentación, sin lógica.

const fila: FilaAsistencia = {
  alumno: { id: 12, apellido: 'Pérez', nombre: 'Juan', fotoUrl: null },
  materia: { id: 3, nombre: 'Matemática' },
  temas: 'Ecuaciones de primer grado',
  horaInicio: '08:00',
  horaFin: '11:00',
  horas: 3,
  ocurrencias: [
    {
      turnoId: 41,
      fecha: '2026-10-13',
      horaInicio: '08:00',
      horaFin: '09:00',
      estado: 'REALIZADO',
      asistencia: {
        estado: 'PRESENTE',
        trabajado: 'Despeje de incógnitas',
        indicaciones: 'Repasar los ejercicios 1 a 5',
        observacion: null,
      },
    },
    {
      turnoId: 42,
      fecha: '2026-10-13',
      horaInicio: '09:00',
      horaFin: '10:00',
      estado: 'AGENDADO',
      asistencia: null,
    },
    {
      turnoId: 43,
      fecha: '2026-10-13',
      horaInicio: '10:00',
      horaFin: '11:00',
      estado: 'AGENDADO',
      asistencia: null,
    },
  ],
  indicacionesAnteriores: { fecha: '2026-10-06', indicaciones: 'Traer la carpeta' },
}

export const ejemploDelDia: AsistenciasDelDia = {
  fecha: '2026-10-13',
  plazo: { vence: '2026-10-20', vencido: false },
  editable: true,
  clases: [
    {
      bloqueAgendaId: 7,
      horaInicio: '08:00',
      horaFin: '09:00',
      aula: { id: 1, nombre: 'Aula 1' },
      filas: [fila],
    },
  ],
}

export const ejemploPendientes: AsistenciasPendientes = {
  cantidad: 3,
  masAntiguo: { fecha: '2026-10-08', vence: '2026-10-15' },
}

export const ejemploRegistrar: RegistrarAsistencias = {
  registros: [
    {
      ocurrencias: [
        { turnoId: 41, fecha: '2026-10-13' },
        { turnoId: 42, fecha: '2026-10-13' },
        { turnoId: 43, fecha: '2026-10-13' },
      ],
      estado: 'PRESENTE',
      trabajado: 'Despeje de incógnitas',
      indicaciones: 'Repasar los ejercicios 1 a 5',
    },
  ],
}

export const ejemploRegistradas = { filas: [fila] }

export const ejemploErrorCancelado = {
  error: {
    code: 'TURNO_CANCELADO',
    message: 'El turno está cancelado: no se puede registrar su asistencia',
  },
}

export const ejemploErrorFueraDePlazo = {
  error: {
    code: 'FUERA_DE_PLAZO',
    message: 'El plazo para registrar esta asistencia venció el 12/10',
  },
}
