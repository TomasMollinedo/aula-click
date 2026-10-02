import type { ErrorResponse } from '@/server/errors'
import type { Tablero } from './tablero.validation'

// Ejemplos del OpenAPI del tablero (Swagger en /api/v1/docs), usados en tablero.routes. Solo datos:
// sin lógica. `satisfies` los mantiene alineados con los schemas. Importes como número JSON. Hoy es
// el viernes 02/10/2026 y el período, "esta semana" (28/09 al 04/10).

export const ejemploTablero = {
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  hoy: '2026-10-02',
  turnos: {
    total: 48,
    cancelados: { cantidad: 6, porcentaje: 12.5 },
    sinRegistrar: { cantidad: 26, porcentaje: 54.2 },
    agendados: { cantidad: 16, porcentaje: 33.3 },
    asistio: { disponible: false },
    noAsistio: { disponible: false },
  },
  ocupacion: { turnos: 42, capacidad: 64, porcentaje: 65.6 },
  alumnos: { nuevos: 3, atendidos: { disponible: false } },
  materiasConMasDemanda: [
    { materia: { id: 2, nombre: 'Matemática' }, cantidad: 15 },
    { materia: { id: 7, nombre: 'Física' }, cantidad: 9 },
    { materia: { id: 4, nombre: 'Inglés' }, cantidad: 8 },
    { materia: { id: 5, nombre: 'Química' }, cantidad: 6 },
    { materia: { id: 9, nombre: 'Lengua' }, cantidad: 4 },
  ],
  profesoresConMasActividad: { disponible: false },
  pagos: { totalCobrado: 96000, totalAdeudado: 296000.5 },
} satisfies Tablero

export const ejemploErrorPeriodo = {
  error: {
    code: 'VALIDACION',
    message: 'Datos de entrada inválidos',
    details: [
      {
        code: 'custom',
        path: ['hasta'],
        message: 'La fecha hasta no puede ser anterior a la fecha desde',
      },
    ],
  },
} satisfies ErrorResponse

export const ejemploErrorSinSesion = {
  error: { code: 'NO_AUTENTICADO', message: 'Se requiere iniciar sesión' },
} satisfies ErrorResponse

export const ejemploErrorSinPermiso = {
  error: { code: 'SIN_PERMISO', message: 'No tenés permiso para esta operación' },
} satisfies ErrorResponse
