import type { ErrorResponse } from '@/server/errors'
import type { LiquidacionDetalle, LiquidacionesDelMes } from './liquidaciones.validation'

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
