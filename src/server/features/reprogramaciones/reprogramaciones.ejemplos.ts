import type { ErrorResponse } from '@/server/errors'
import type { ReprogramarTurno, TurnoReprogramado } from './reprogramaciones.validation'

// Ejemplos del OpenAPI de reprogramaciones (Swagger en /api/v1/docs), usados en
// reprogramaciones.routes. Solo datos: sin lógica. `satisfies` los mantiene alineados con los
// schemas.

export const ejemploReprogramar = {
  turnoId: 41,
  fecha: '2026-10-12',
  bloqueAgendaDestinoId: 18,
  fechaDestino: '2026-10-15',
} satisfies ReprogramarTurno

export const ejemploReprogramado = {
  turnoId: 58,
  cambio: 'Del lunes 12/10 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz',
} satisfies TurnoReprogramado

export const ejemploErrorBloqueLleno = {
  error: {
    code: 'BLOQUE_LLENO',
    message: 'La hora de destino no tiene lugar en esa fecha',
    details: [
      {
        path: ['bloqueAgendaDestinoId'],
        message: 'La hora de 17:00 a 18:00 está completa el jueves 15/10',
        bloqueId: 18,
        capacidadEfectiva: 2,
        ocupacion: 2,
      },
    ],
  },
} satisfies ErrorResponse
