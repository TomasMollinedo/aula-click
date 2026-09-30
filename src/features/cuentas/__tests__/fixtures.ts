import type { AdeudadosGlobal, CuentaDelAlumno, OcurrenciaDeCuenta } from '../cuentas.types'

// Copia de `src/server/features/cuentas/cuentas.ejemplos.ts` (los ejemplos del OpenAPI): el frontend
// no importa de `@/server`. `satisfies` controla que sigan la forma de los tipos del frontend; si el
// contrato cambia, se cambian los dos.

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

export const CUENTA = {
  totalAdeudado: 16000,
  pagadoDelMes: 32000,
  adeudados: [adeudado, { ...adeudado, fecha: '2026-09-28' }],
  proximos: [
    { ...adeudado, fecha: '2026-10-05', estado: 'AGENDADO' },
    {
      turnoId: 57,
      fecha: '2026-10-07',
      horaInicio: '17:00',
      horaFin: '18:00',
      materia: { id: 7, nombre: 'Física' },
      profesor: { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
      estado: 'AGENDADO',
      importe: 9000,
    },
  ],
  pagos: [
    { pagoId: 31, numeroComprobante: 1024, fechaPago: '2026-10-01', cantidad: 4, total: 32000 },
    { pagoId: 18, numeroComprobante: 1011, fechaPago: '2026-09-02', cantidad: 2, total: 16000 },
  ],
} satisfies CuentaDelAlumno

export const ADEUDADOS = {
  data: [
    {
      ...adeudado,
      alumno: { id: 12, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
    },
    {
      turnoId: 63,
      fecha: '2026-09-22',
      horaInicio: '18:00',
      horaFin: '19:00',
      materia: { id: 7, nombre: 'Física' },
      profesor: { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
      estado: 'SIN_REGISTRAR',
      importe: 9000.5,
      alumno: { id: 15, nombre: 'Tomás', apellido: 'Paz', dni: '50111222' },
    },
  ],
  meta: { page: 1, pageSize: 2, total: 5, totalPages: 3 },
  totalAdeudado: 43001.5,
} satisfies AdeudadosGlobal
