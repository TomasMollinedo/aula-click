import type { ErrorResponse } from '@/server/errors'
import type {
  LiquidacionDetalle,
  LiquidacionesDelMes,
  LiquidacionPagada,
  MiLiquidacion,
  MisIngresos,
  MisLiquidaciones,
  PagarLiquidacion,
} from './liquidaciones.validation'

// Ejemplos del OpenAPI de liquidaciones (Swagger en /api/v1/docs), usados en liquidaciones.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

const gerente = { id: 'usr_gerente_01', nombre: 'Marta', apellido: 'Ríos' }
const gomez = { id: 4, nombre: 'Ana', apellido: 'Gómez' }

export const ejemploLiquidacionesDelMes = {
  mes: '2026-09',
  totales: {
    cantidadTurnos: 19,
    totalCobrado: 152000,
    parteCentro: 22800,
    parteProfesor: 129200,
    totalAjustes: -6800,
    total: 122400,
  },
  data: [
    {
      profesor: gomez,
      estado: 'PAGADA',
      cantidadTurnos: 12,
      totalCobrado: 96000,
      parteCentro: 14400,
      parteProfesor: 81600,
      totalAjustes: 0,
      total: 81600,
      fechaTransferencia: '2026-10-05',
      descontadaEnMes: null,
    },
    {
      profesor: { id: 7, nombre: 'Julián', apellido: 'Paz' },
      estado: 'PENDIENTE_DE_PAGO',
      cantidadTurnos: 6,
      totalCobrado: 48000,
      parteCentro: 7200,
      parteProfesor: 40800,
      totalAjustes: 0,
      total: 40800,
      fechaTransferencia: null,
      descontadaEnMes: null,
    },
    {
      profesor: { id: 9, nombre: 'Carla', apellido: 'Ruiz' },
      estado: 'SALDO_A_DESCONTAR',
      cantidadTurnos: 1,
      totalCobrado: 8000,
      parteCentro: 1200,
      parteProfesor: 6800,
      totalAjustes: -6800,
      total: 0,
      fechaTransferencia: null,
      descontadaEnMes: null,
    },
  ],
  meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
} satisfies LiquidacionesDelMes

export const ejemploLiquidacionDetalle = {
  profesor: gomez,
  mes: '2026-09',
  estado: 'PAGADA',
  turnos: [
    {
      fecha: '2026-09-08',
      horaInicio: '15:00',
      horaFin: '16:00',
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      materia: { id: 2, nombre: 'Matemática' },
      numeroComprobante: 123,
      importe: 8000,
      porcentaje: 15,
      parteProfesor: 6800,
    },
  ],
  ajustes: [],
  cantidadTurnos: 1,
  totalCobrado: 8000,
  parteCentro: 1200,
  parteProfesor: 6800,
  totalAjustes: 0,
  total: 6800,
  cerrada: {
    liquidacionId: 31,
    fechaTransferencia: '2026-10-05',
    numeroOperacion: '0004829137',
    observaciones: null,
    descontadaEnMes: null,
    comprobanteAdjunto: {
      id: 44,
      nombre: 'transferencia-gomez.pdf',
      tipo: 'application/pdf',
      bytes: 248312,
      adjuntadoPor: gerente,
      adjuntadoEl: '2026-10-05T14:02:00.000Z',
    },
    registradaPor: gerente,
    registradaEl: '2026-10-05T14:03:00.000Z',
  },
  acciones: { registrarPago: false },
} satisfies LiquidacionDetalle

export const ejemploErrorMesFuturo = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [{ path: ['mes'], message: 'El mes no puede ser futuro' }],
  },
} satisfies ErrorResponse

export const ejemploErrorProfesorNoEncontrado = {
  error: { code: 'NO_ENCONTRADO', message: 'Profesor no encontrado' },
} satisfies ErrorResponse

export const ejemploPagarLiquidacion = {
  fechaTransferencia: '2026-10-05',
  numeroOperacion: '0004829137',
  comprobanteAdjuntoId: 44,
  observaciones: null,
  totalConfirmado: 81600,
} satisfies PagarLiquidacion

export const ejemploLiquidacionPagada = {
  liquidacionId: 31,
  profesor: gomez,
  mes: '2026-09',
  total: 81600,
  fechaTransferencia: '2026-10-05',
} satisfies LiquidacionPagada

export const ejemploErrorFechaTransferencia = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [
      {
        path: ['fechaTransferencia'],
        message: 'La transferencia no puede ser anterior al 30/09/2026',
      },
    ],
  },
} satisfies ErrorResponse

export const ejemploErrorMesNoTerminado = {
  error: {
    code: 'CONFLICTO',
    message: 'La liquidación de octubre de 2026 todavía no se puede pagar: el mes no terminó',
  },
} satisfies ErrorResponse

export const ejemploErrorSinImporte = {
  error: { code: 'CONFLICTO', message: 'No hay importe a pagar' },
} satisfies ErrorResponse

export const ejemploErrorLiquidacionPagada = {
  error: {
    code: 'LIQUIDACION_PAGADA',
    message: 'La liquidación de septiembre de 2026 de Gómez, Ana ya está pagada',
  },
} satisfies ErrorResponse

export const ejemploErrorLiquidacionModificada = {
  error: {
    code: 'LIQUIDACION_MODIFICADA',
    message: 'La liquidación cambió desde que la abriste. Revisala antes de pagar',
  },
} satisfies ErrorResponse

// ---------- "Mis ingresos" del profesor (T-126) ----------

const alumnaPerez = { id: 12, nombre: 'Lucía', apellido: 'Pérez' }
const matematica = { id: 3, nombre: 'Matemática' }

export const ejemploMiLiquidacion = {
  mes: '2026-09',
  estado: 'PAGADA',
  turnos: [
    {
      fecha: '2026-09-07',
      horaInicio: '16:00',
      horaFin: '17:00',
      alumno: alumnaPerez,
      materia: matematica,
      importe: 8000,
      porcentaje: 15,
      parteProfesor: 6800,
    },
  ],
  ajustes: [],
  cantidadTurnos: 1,
  totalCobrado: 8000,
  parteCentro: 1200,
  parteProfesor: 6800,
  totalAjustes: 0,
  total: 6800,
  cerrada: {
    liquidacionId: 31,
    fechaTransferencia: '2026-10-05',
    numeroOperacion: '0004829137',
    descontadaEnMes: null,
  },
} satisfies MiLiquidacion

export const ejemploMisIngresos = {
  esteMes: {
    ...ejemploMiLiquidacion,
    mes: '2026-10',
    estado: 'EN_CURSO',
    turnos: [{ ...ejemploMiLiquidacion.turnos[0], fecha: '2026-10-05' }],
    cerrada: null,
  },
  clasesSinCobrar: [
    {
      turnoId: 41,
      fecha: '2026-10-12',
      horaInicio: '16:00',
      horaFin: '17:00',
      alumno: alumnaPerez,
      materia: matematica,
    },
  ],
  clasesCobradasSinAsistencia: [
    {
      turnoId: 44,
      fecha: '2026-10-14',
      horaInicio: '17:00',
      horaFin: '18:00',
      alumno: { id: 15, nombre: 'Tomás', apellido: 'Aguirre' },
      materia: matematica,
      vence: '2026-10-21',
    },
  ],
} satisfies MisIngresos

export const ejemploMisLiquidaciones = {
  data: [
    { mes: '2026-09', estado: 'PAGADA', total: 81600, fechaTransferencia: '2026-10-05' },
    { mes: '2026-08', estado: 'PAGADA', total: 74800, fechaTransferencia: '2026-09-04' },
  ],
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
} satisfies MisLiquidaciones
