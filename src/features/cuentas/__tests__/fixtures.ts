import type {
  AdeudadosGlobal,
  CuentaDelAlumno,
  OcurrenciaDeCuenta,
  ProximosGlobal,
} from '../cuentas.types'

// Copia de `src/server/features/cuentas/cuentas.ejemplos.ts` (los ejemplos del OpenAPI): el frontend
// no importa de `@/server`. `satisfies` controla que sigan la forma de los tipos del frontend; si el
// contrato cambia, se cambian los dos. Hoy es el 01/10/2026: el tope de cobro es el 26/11/2026.

const adeudado = {
  turnoId: 41,
  fecha: '2026-09-21',
  horaInicio: '09:00',
  horaFin: '10:00',
  materia: { id: 2, nombre: 'Matemática' },
  profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
  estado: 'SIN_REGISTRAR',
  importe: 8000,
} satisfies OcurrenciaDeCuenta

const proximoDeFisica = {
  turnoId: 57,
  fecha: '2026-10-07',
  horaInicio: '17:00',
  horaFin: '18:00',
  materia: { id: 7, nombre: 'Física' },
  profesor: { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
  estado: 'AGENDADO',
  importe: 9000,
} satisfies OcurrenciaDeCuenta

const lucia = { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' }
const tomas = { id: 15, nombre: 'Tomás', apellido: 'Paz', dni: '50111222' }

export const CUENTA = {
  totalAdeudado: 16000,
  adeudados: [adeudado, { ...adeudado, fecha: '2026-09-28' }],
  proximos: [{ ...adeudado, fecha: '2026-10-05', estado: 'AGENDADO' }, proximoDeFisica],
  limiteCobro: '2026-11-26',
} satisfies CuentaDelAlumno

export const ADEUDADOS = {
  data: [
    { ...adeudado, alumno: lucia },
    {
      turnoId: 63,
      fecha: '2026-09-22',
      horaInicio: '18:00',
      horaFin: '19:00',
      materia: { id: 7, nombre: 'Física' },
      profesor: { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
      estado: 'SIN_REGISTRAR',
      importe: 9000.5,
      alumno: tomas,
    },
  ],
  meta: { page: 1, pageSize: 2, total: 5, totalPages: 3 },
  totalAdeudado: 43001.5,
  aplica: true,
} satisfies AdeudadosGlobal

export const PROXIMOS = {
  data: [
    { ...adeudado, fecha: '2026-10-05', estado: 'AGENDADO', alumno: lucia },
    { ...proximoDeFisica, alumno: tomas },
  ],
  meta: { page: 1, pageSize: 2, total: 9, totalPages: 5 },
  aplica: true,
  limiteCobro: '2026-11-26',
} satisfies ProximosGlobal
