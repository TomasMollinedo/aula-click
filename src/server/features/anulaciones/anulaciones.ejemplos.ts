import type { ErrorResponse } from '@/server/errors'
import type { AnularPago, PagoAnulado, PreviaAnulacion } from './anulaciones.validation'

// Ejemplos del OpenAPI de anulaciones (Swagger en /api/v1/docs), usados en anulaciones.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploPrevia = {
  pago: {
    id: 31,
    numeroComprobante: 123,
    alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
    total: 32000,
    cantidad: 4,
  },
  avisos: {
    deuda: { cantidad: 5, total: 40000, turnosDelPago: 4 },
    precios: [{ materia: { id: 2, nombre: 'Matemática' }, cobrado: 8000, vigente: 9000 }],
    transferenciaCompartida: {
      operacion: '0004829137',
      banco: 'Banco Macro',
      pagos: [
        {
          pagoId: 32,
          numeroComprobante: 124,
          alumno: { id: 14, nombre: 'Lucía', apellido: 'Álvarez' },
        },
      ],
    },
  },
} satisfies PreviaAnulacion

export const ejemploAnular = {
  pagoId: 31,
  motivo: 'ERROR_CARGA',
  detalle: 'Se cargó el alumno equivocado',
} satisfies AnularPago

export const ejemploPagoAnulado = { pagoId: 31, cantidad: 4 } satisfies PagoAnulado

export const ejemploErrorPagoAnulado = {
  error: {
    code: 'PAGO_ANULADO',
    message: 'Un pago anulado no se puede volver a activar',
  },
} satisfies ErrorResponse

export const ejemploErrorTurnosDictados = {
  error: {
    code: 'TURNOS_DICTADOS',
    message: 'No se puede anular: el pago incluye turnos que ya se dictaron',
    details: [
      { fecha: '2026-10-05', materia: { id: 2, nombre: 'Matemática' }, asistencia: 'PRESENTE' },
      { fecha: '2026-10-12', materia: { id: 2, nombre: 'Matemática' }, asistencia: 'AUSENTE' },
    ],
  },
} satisfies ErrorResponse
