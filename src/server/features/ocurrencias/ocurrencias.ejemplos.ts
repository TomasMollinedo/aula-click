import type {
  MiTurnoDetalle,
  MiTurnoItem,
  OcurrenciaDelAlumnoItem,
  OcurrenciaDetalle,
} from './ocurrencias.validation'

// Ejemplos del OpenAPI de `ocurrencias` (Swagger en /api/v1/docs), usados en ocurrencias.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

const auditoria = {
  createdAt: '2026-08-01T13:00:00.000Z',
  createdBy: { id: 'usr_1', nombre: 'Ana', apellido: 'Pérez', rol: 'MESA_ENTRADAS' as const },
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
  pago: { estado: 'PENDIENTE', importeVigente: 8000 },
  prioridad: 'ALTA',
  examen: {
    id: 8,
    fecha: '2026-10-05',
    tipo: 'PARCIAL',
    materiaNombre: 'Matemática',
    dias: 7,
  },
  plazoAsistencia: null,
  asistencia: null,
  horasSeguidas: null,
  acciones: {
    cancelar: { visible: true, habilitada: true },
    finalizar: { visible: true },
    reprogramar: { visible: true },
    registrarPago: { visible: true },
    registrarAsistencia: { visible: false },
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
    estadoPago: 'PENDIENTE',
    prioridad: 'ALTA',
    cancelable: true,
    plazoAsistencia: null,
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
    estadoPago: 'PENDIENTE',
    prioridad: null,
    cancelable: false,
    plazoAsistencia: null,
  },
] satisfies OcurrenciaDelAlumnoItem[]

/** Portal (HU-30): "Mi calendario". Sin prioridad, ocupación, `cancelable` ni auditoría. */
export const ejemploMisTurnos = [
  {
    turnoId: 31,
    fecha: '2026-10-05',
    diaSemana: 1,
    horaInicio: '08:00',
    horaFin: '09:00',
    materia: { id: 3, nombre: 'Matemática' },
    profesor: { id: 3, nombre: 'Ana', apellido: 'Pérez' },
    aula: { id: 3, nombre: 'Aula 3' },
    tipo: 'RECURRENTE',
    estado: 'REALIZADO',
    estadoPago: 'PAGADO',
  },
  {
    turnoId: 32,
    fecha: '2026-10-05',
    diaSemana: 1,
    horaInicio: '09:00',
    horaFin: '10:00',
    materia: { id: 3, nombre: 'Matemática' },
    profesor: { id: 3, nombre: 'Ana', apellido: 'Pérez' },
    aula: { id: 3, nombre: 'Aula 3' },
    tipo: 'RECURRENTE',
    estado: 'REALIZADO',
    estadoPago: 'PENDIENTE',
  },
] satisfies MiTurnoItem[]

/** Portal (HU-30): el detalle de una hora con sus horas seguidas y los textos una sola vez. */
export const ejemploMiTurno = {
  turnoId: 31,
  fecha: '2026-10-05',
  horaInicio: '08:00',
  horaFin: '09:00',
  materia: { id: 3, nombre: 'Matemática' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Pérez' },
  aula: { id: 3, nombre: 'Aula 3' },
  tipo: 'RECURRENTE',
  temas: 'Fracciones',
  estado: 'REALIZADO',
  plazoAsistencia: { vence: '2026-10-12', vencido: false },
  estadoPago: 'PAGADO',
  asistencia: {
    estado: 'PRESENTE',
    trabajado: 'Suma y resta de fracciones',
    indicaciones: 'Hacer la guía 3',
    cerradaPorSistema: false,
  },
  horasSeguidas: {
    horaInicio: '08:00',
    horaFin: '10:00',
    horas: 2,
    textos: { trabajado: 'Suma y resta de fracciones', indicaciones: 'Hacer la guía 3' },
    ocurrencias: [
      {
        turnoId: 31,
        fecha: '2026-10-05',
        horaInicio: '08:00',
        horaFin: '09:00',
        estado: 'REALIZADO',
        plazoAsistencia: { vence: '2026-10-12', vencido: false },
        actual: true,
        textosPropios: null,
      },
      {
        turnoId: 32,
        fecha: '2026-10-05',
        horaInicio: '09:00',
        horaFin: '10:00',
        estado: 'REALIZADO',
        plazoAsistencia: { vence: '2026-10-12', vencido: false },
        actual: false,
        textosPropios: null,
      },
    ],
  },
} satisfies MiTurnoDetalle
