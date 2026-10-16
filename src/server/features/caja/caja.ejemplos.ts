import type { ErrorResponse } from '@/server/errors'
import type { Caja } from './caja.validation'

// Ejemplos del OpenAPI de la caja diaria (Swagger en /api/v1/docs), usados en caja.routes. Solo
// datos: sin lógica. `satisfies` los mantiene alineados con los schemas. Importes como número JSON.
// Hoy es el jueves 15/10/2026 (la hora, en UTC: Salta es UTC−3).

const efectivo = { codigo: 'EFECTIVO', nombre: 'Efectivo' } as const
const transferencia = { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' } as const

export const ejemploCaja = {
  fecha: '2026-10-15',
  movimientos: [
    {
      tipo: 'COBRO',
      registradoEl: '2026-10-15T12:10:00.000Z',
      pagoId: 31,
      numeroComprobante: 1024,
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      formaPago: efectivo,
      importe: 16000,
      estado: 'ANULADO',
    },
    {
      tipo: 'COBRO',
      registradoEl: '2026-10-15T13:45:00.000Z',
      pagoId: 32,
      numeroComprobante: 1025,
      alumno: { id: 15, nombre: 'Lucía', apellido: 'González' },
      formaPago: transferencia,
      importe: 8000,
      estado: 'VIGENTE',
    },
    {
      tipo: 'ANULACION',
      registradoEl: '2026-10-15T14:20:00.000Z',
      pagoId: 31,
      numeroComprobante: 1024,
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      formaPago: efectivo,
      importe: 16000,
      motivo: 'ERROR_CARGA',
      detalle: 'Se cargó dos veces',
    },
    {
      tipo: 'PAGO_PROFESOR',
      registradoEl: '2026-10-15T15:05:00.000Z',
      profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
      mes: '2026-09',
      numeroOperacion: '0048213',
      formaPago: transferencia,
      importe: 6800,
      liquidacion: { profesorId: 4, mes: '2026-09' },
    },
  ],
  resumen: {
    ingresos: {
      porForma: { EFECTIVO: 0, TRANSFERENCIA: 8000, DEBITO: 0 },
      total: 8000,
      parteCentro: 1200,
      parteProfesores: 6800,
    },
    egresos: 6800,
    saldo: 1200,
  },
} satisfies Caja

export const ejemploCajaVacia = {
  fecha: '2026-10-14',
  movimientos: [],
  resumen: {
    ingresos: {
      porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
      total: 0,
      parteCentro: 0,
      parteProfesores: 0,
    },
    egresos: 0,
    saldo: 0,
  },
} satisfies Caja

export const ejemploErrorFechaFutura = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [{ path: ['fecha'], message: 'No se puede consultar la caja de una fecha futura' }],
  },
} satisfies ErrorResponse

export const ejemploErrorSinSesion = {
  error: { code: 'NO_AUTENTICADO', message: 'Se requiere iniciar sesión' },
} satisfies ErrorResponse

export const ejemploErrorSinPermiso = {
  error: { code: 'SIN_PERMISO', message: 'No tenés permiso para esta operación' },
} satisfies ErrorResponse
