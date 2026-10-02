import type { ErrorResponse } from '@/server/errors'
import type {
  FinalizacionCreada,
  FinalizarTurno,
  PreviaFinalizacion,
} from './finalizaciones.validation'

// Ejemplos del OpenAPI de finalizaciones (Swagger en /api/v1/docs), usados en
// finalizaciones.routes. Solo datos: sin lógica. `satisfies` los mantiene alineados con los schemas.

export const ejemploPrevia = {
  cantidad: 7,
  desde: '2026-10-19',
  hasta: '2026-11-30',
  pagadas: [],
  ultimaFechaPagada: null,
  fechaDesdeMinima: null,
  otrasHoras: [{ turnoId: 42, fecha: '2026-10-19', horaInicio: '10:00', horaFin: '11:00' }],
} satisfies PreviaFinalizacion

export const ejemploFinalizar = {
  turnoId: 41,
  fechaDesde: '2026-10-19',
  motivo: 'CANCELACION_ALUMNO',
  detalle: 'El alumno deja de venir',
} satisfies FinalizarTurno

export const ejemploFinalizada = {
  turnoId: 41,
  cantidad: 7,
  desde: '2026-10-19',
  hasta: '2026-11-30',
} satisfies FinalizacionCreada

export const ejemploErrorYaFinalizado = {
  error: { code: 'CONFLICTO', message: 'El turno ya fue finalizado' },
} satisfies ErrorResponse

export const ejemploErrorTurnosPagados = {
  error: {
    code: 'TURNOS_PAGADOS',
    message:
      'Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (26/10)',
    details: {
      ultimaFechaPagada: '2026-10-26',
      fechaDesdeMinima: '2026-11-02',
      pagadas: [
        { fecha: '2026-10-19', horaInicio: '09:00', horaFin: '10:00', importe: 8500 },
        { fecha: '2026-10-26', horaInicio: '09:00', horaFin: '10:00', importe: 8500 },
      ],
    },
  },
} satisfies ErrorResponse
