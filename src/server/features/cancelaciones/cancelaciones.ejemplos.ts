import type { ErrorResponse } from '@/server/errors'
import type { CancelacionesCreadas, CancelarTurnos } from './cancelaciones.validation'

// Ejemplos del OpenAPI de cancelaciones (Swagger en /api/v1/docs), usados en cancelaciones.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploCancelar = {
  ocurrencias: [
    { turnoId: 41, fecha: '2026-10-12' },
    { turnoId: 57, fecha: '2026-10-14' },
  ],
  motivo: 'CANCELACION_ALUMNO',
  detalle: 'El alumno viaja esa semana',
} satisfies CancelarTurnos

export const ejemploCanceladas = { cantidad: 2 } satisfies CancelacionesCreadas

export const ejemploErrorNoCancelables = {
  error: {
    code: 'TURNOS_NO_CANCELABLES',
    message: 'Algunos turnos no se pueden cancelar',
    details: [
      {
        path: ['ocurrencias', 1],
        message: 'El turno está pagado: no se puede cancelar',
        turnoId: 57,
        fecha: '2026-10-14',
        motivo: 'PAGADO',
        pagoId: 29,
      },
    ],
  },
} satisfies ErrorResponse
