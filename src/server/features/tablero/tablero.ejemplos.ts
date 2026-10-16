import type { ErrorResponse } from '@/server/errors'
import type { Tablero, TableroAsistencia, TableroFinanzas } from './tablero.validation'

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

// "Finanzas" de "este mes" (octubre), con hoy el jueves 15/10/2026, al 15 %. Pérez tiene un turno
// de $ 8.000 cobrado y cerrado sin registrar: entra entero en su parte del centro y en el margen
// (6.000 + 8.000). Ruiz no cobró nada en el período y tiene un saldo a descontar: aparece en la
// tabla con su saldo negativo, que no resta en `saldoAPagarAProfesores` (27.200 + 20.400).
export const ejemploTableroFinanzas = {
  periodo: { desde: '2026-10-01', hasta: '2026-10-31' },
  hoy: '2026-10-15',
  resumen: {
    totalCobrado: 128000,
    margenCentro: { importe: 26000, porcentaje: 20.3 },
    incluyeSinRegistrar: 8000,
    pagadoAProfesores: 40800,
    saldoAPagarAProfesores: 47600,
  },
  profesores: {
    data: [
      {
        profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
        turnosCobrados: 10,
        totalCobrado: 80000,
        parteCentro: 12000,
        parteProfesor: 68000,
        pagado: 40800,
        saldoPendiente: 27200,
      },
      {
        profesor: { id: 5, nombre: 'Luis', apellido: 'Pérez' },
        turnosCobrados: 6,
        totalCobrado: 48000,
        parteCentro: 14000,
        parteProfesor: 34000,
        pagado: 0,
        saldoPendiente: 20400,
      },
      {
        profesor: { id: 8, nombre: 'Marta', apellido: 'Ruiz' },
        turnosCobrados: 0,
        totalCobrado: 0,
        parteCentro: 0,
        parteProfesor: 0,
        pagado: 0,
        saldoPendiente: -6800,
      },
    ],
    meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
  },
  evolucion: [
    { mes: '2026-05', totalCobrado: 0, margenCentro: 0, pagadoAProfesores: 0 },
    { mes: '2026-06', totalCobrado: 64000, margenCentro: 9600, pagadoAProfesores: 0 },
    { mes: '2026-07', totalCobrado: 96000, margenCentro: 14400, pagadoAProfesores: 54400 },
    { mes: '2026-08', totalCobrado: 112000, margenCentro: 16800, pagadoAProfesores: 81600 },
    { mes: '2026-09', totalCobrado: 104000, margenCentro: 23600, pagadoAProfesores: 95200 },
    { mes: '2026-10', totalCobrado: 128000, margenCentro: 26000, pagadoAProfesores: 40800 },
  ],
} satisfies TableroFinanzas

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
