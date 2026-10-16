import type { ErrorResponse } from '@/server/errors'
import type {
  CambiarPorcentaje,
  PorcentajeCentro,
  PorcentajeCentroConHistorial,
} from './reparto.validation'

// Ejemplos del OpenAPI de reparto (Swagger en /api/v1/docs), usados en reparto.routes.
// Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

const gerente = { id: 'usr_gerente_01', nombre: 'Marta', apellido: 'Ríos' }

export const ejemploPorcentaje = {
  porcentaje: 18,
  desde: '2026-10-15T20:10:00.000Z',
  cambiadoPor: gerente,
} satisfies PorcentajeCentro

export const ejemploPorcentajeConHistorial = {
  vigente: ejemploPorcentaje,
  historial: {
    data: [
      { id: 3, ...ejemploPorcentaje },
      { id: 2, porcentaje: 15, desde: '2026-09-01T03:00:00.000Z', cambiadoPor: gerente },
      { id: 1, porcentaje: 12, desde: '2026-08-01T03:00:00.000Z', cambiadoPor: gerente },
    ],
    meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
  },
} satisfies PorcentajeCentroConHistorial

export const ejemploCambiarPorcentaje = { porcentaje: 18 } satisfies CambiarPorcentaje

export const ejemploErrorPorcentajeInvalido = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [
      {
        path: ['porcentaje'],
        message:
          'El porcentaje debe ser mayor o igual a 0 y menor que 100, con hasta dos decimales',
      },
    ],
  },
} satisfies ErrorResponse

export const ejemploErrorMismoPorcentaje = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [{ path: ['porcentaje'], message: 'El porcentaje ya es 15 %' }],
  },
} satisfies ErrorResponse
