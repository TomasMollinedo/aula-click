import type { ErrorResponse } from '@/server/errors'
import type { Tablero, TableroAsistencia } from './tablero.validation'

// Ejemplos del OpenAPI del tablero (Swagger en /api/v1/docs), usados en tablero.routes. Solo datos:
// sin lógica. `satisfies` los mantiene alineados con los schemas. Importes como número JSON. Hoy es
// el viernes 02/10/2026 y el período, "esta semana" (28/09 al 04/10).

export const ejemploTablero = {
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  hoy: '2026-10-02',
  turnos: {
    total: 48,
    cancelados: { cantidad: 6, porcentaje: 12.5 },
    sinRegistrar: { cantidad: 6, porcentaje: 12.5 },
    agendados: { cantidad: 16, porcentaje: 33.3 },
    asistio: { cantidad: 17, porcentaje: 85 },
    noAsistio: { cantidad: 3, porcentaje: 15 },
  },
  ocupacion: { turnos: 42, capacidad: 64, porcentaje: 65.6 },
  alumnos: { nuevos: 3, atendidos: 14 },
  materiasConMasDemanda: [
    { materia: { id: 2, nombre: 'Matemática' }, cantidad: 15 },
    { materia: { id: 7, nombre: 'Física' }, cantidad: 9 },
    { materia: { id: 4, nombre: 'Inglés' }, cantidad: 8 },
    { materia: { id: 5, nombre: 'Química' }, cantidad: 6 },
    { materia: { id: 9, nombre: 'Lengua' }, cantidad: 4 },
  ],
  profesoresConMasTurnos: [
    { profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' }, cantidad: 14 },
    { profesor: { id: 5, nombre: 'Luis', apellido: 'Pérez' }, cantidad: 11 },
    { profesor: { id: 8, nombre: 'Marta', apellido: 'Ruiz' }, cantidad: 9 },
  ],
  pagos: {
    totalCobrado: 96000,
    cobradoPorForma: { EFECTIVO: 40000, TRANSFERENCIA: 38000, DEBITO: 18000 },
    totalAdeudado: 296000.5,
  },
} satisfies Tablero

export const ejemploTableroAsistencia = {
  periodo: { desde: '2026-09-28', hasta: '2026-10-04' },
  hoy: '2026-10-02',
  resumen: {
    porcentajeAsistencia: 85,
    cerradosSinRegistrar: 5,
    profesoresSinRegistrar: 2,
    alumnosBajoElUmbral: 3,
  },
  profesores: {
    data: [
      {
        profesor: { id: 5, nombre: 'Luis', apellido: 'Pérez' },
        clasesRealizadas: 6,
        ausencias: 1,
        porcentajeAsistencia: 85.7,
        cerradosSinRegistrar: 3,
        dentroDelPlazo: 1,
        porcentajeSinRegistrar: 27.3,
        noRegistraAsistencia: true,
      },
      {
        profesor: { id: 8, nombre: 'Marta', apellido: 'Ruiz' },
        clasesRealizadas: 5,
        ausencias: 1,
        porcentajeAsistencia: 83.3,
        cerradosSinRegistrar: 2,
        dentroDelPlazo: 0,
        porcentajeSinRegistrar: 22.2,
        noRegistraAsistencia: true,
      },
      {
        profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
        clasesRealizadas: 6,
        ausencias: 1,
        porcentajeAsistencia: 85.7,
        cerradosSinRegistrar: 0,
        dentroDelPlazo: 2,
        porcentajeSinRegistrar: 0,
        noRegistraAsistencia: false,
      },
    ],
    meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
  },
  materias: {
    data: [
      {
        materia: { id: 2, nombre: 'Matemática' },
        clasesRealizadas: 8,
        ausencias: 1,
        porcentajeAsistencia: 88.9,
        cerradosSinRegistrar: 3,
        dentroDelPlazo: 1,
        porcentajeSinRegistrar: 23.1,
      },
      {
        materia: { id: 7, nombre: 'Física' },
        clasesRealizadas: 9,
        ausencias: 2,
        porcentajeAsistencia: 81.8,
        cerradosSinRegistrar: 2,
        dentroDelPlazo: 2,
        porcentajeSinRegistrar: 13.3,
      },
    ],
    meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
  },
} satisfies TableroAsistencia

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
