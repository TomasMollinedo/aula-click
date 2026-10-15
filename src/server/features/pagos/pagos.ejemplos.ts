import type { ErrorResponse } from '@/server/errors'
import type { Comprobante, PagoRegistrado, RegistrarPago } from './pagos.validation'

// Ejemplos del OpenAPI de pagos (Swagger en /api/v1/docs), usados en pagos.routes. Solo datos:
// sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploRegistrar = {
  alumnoId: 12,
  ocurrencias: [
    { turnoId: 41, fecha: '2026-10-05' },
    { turnoId: 41, fecha: '2026-10-12' },
    { turnoId: 57, fecha: '2026-10-07' },
    { turnoId: 57, fecha: '2026-10-14' },
  ],
  fechaPago: '2026-10-05',
  formaPago: 'EFECTIVO',
  montoRecibido: 35000,
  observaciones: 'Paga el mes de octubre',
} satisfies RegistrarPago

/** El mismo cobro por transferencia: sus datos y el comprobante subido con `POST /adjuntos`. */
export const ejemploRegistrarTransferencia = {
  alumnoId: 12,
  ocurrencias: ejemploRegistrar.ocurrencias,
  fechaPago: '2026-10-05',
  formaPago: 'TRANSFERENCIA',
  transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: 'Marta López' },
  comprobanteAdjuntoId: 18,
} satisfies RegistrarPago

/** El mismo cobro con débito: la red, el cupón y, si se quiere, los últimos 4 números. */
export const ejemploRegistrarDebito = {
  alumnoId: 12,
  ocurrencias: ejemploRegistrar.ocurrencias,
  fechaPago: '2026-10-05',
  formaPago: 'DEBITO',
  debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
} satisfies RegistrarPago

export const ejemploRegistrado = {
  pagoId: 31,
  numeroComprobante: 1024,
  cantidad: 4,
  total: 32000,
  formaPago: 'EFECTIVO',
  montoRecibido: 35000,
  vuelto: 3000,
} satisfies PagoRegistrado

export const ejemploComprobante = {
  id: 31,
  numeroComprobante: 1024,
  fechaPago: '2026-10-05',
  alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
  turnos: [
    {
      turnoId: 41,
      fecha: '2026-10-05',
      horaInicio: '09:00',
      horaFin: '10:00',
      materia: { id: 2, nombre: 'Matemática' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
      importe: 8000,
    },
    {
      turnoId: 57,
      fecha: '2026-10-07',
      horaInicio: '17:00',
      horaFin: '18:00',
      materia: { id: 7, nombre: 'Física' },
      profesor: { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
      importe: 8000,
    },
  ],
  total: 16000,
  montoRecibido: 20000,
  vuelto: 4000,
  formaPago: { codigo: 'EFECTIVO', nombre: 'Efectivo' },
  transferencia: null,
  debito: null,
  estado: 'VIGENTE',
  anulacion: null,
  observaciones: null,
  registradoPor: { id: 'usr_mesa_01', nombre: 'Laura', apellido: 'Gómez' },
  registradoEl: '2026-10-05T14:30:00.000Z',
} satisfies Comprobante

export const ejemploErrorNoCobrables = {
  error: {
    code: 'TURNOS_NO_COBRABLES',
    message: 'Algunos turnos no se pueden cobrar',
    details: [
      {
        path: ['ocurrencias', 1],
        message: 'El turno ya está pagado',
        turnoId: 41,
        fecha: '2026-10-12',
        motivo: 'YA_PAGADO',
        pagoId: 29,
      },
      {
        path: ['ocurrencias', 3],
        message: 'El turno está cancelado',
        turnoId: 57,
        fecha: '2026-10-14',
        motivo: 'CANCELADO',
      },
    ],
  },
} satisfies ErrorResponse

export const ejemploErrorMonto = {
  error: {
    code: 'VALIDACION',
    message: 'El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)',
    details: [
      {
        path: ['montoRecibido'],
        message: 'El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)',
      },
    ],
  },
} satisfies ErrorResponse
