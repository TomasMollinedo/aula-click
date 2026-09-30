import type { EstadoTurno } from '@/components/turno/indicadores-turno'
import type { PaginatedResponse } from '@/types'

// Tipos de lo que devuelve la API de cuentas (docs/contrato-api.md → Cuentas; HU-16, T-53), escritos
// a mano (D-07): el frontend no importa los schemas del servidor. Fechas: string `YYYY-MM-DD`. Horas:
// string `HH:mm`. Importes: número JSON en pesos, que calcula la API.

/** `SIN_REGISTRAR` en los adeudados y `AGENDADO` en los próximos. Código, no texto. */
export type EstadoOcurrenciaDeCuenta = Extract<EstadoTurno, 'SIN_REGISTRAR' | 'AGENDADO'>

/**
 * Una ocurrencia de la cuenta: los campos de `OcurrenciaACobrar` (`types/pago.ts`) más `estado`.
 * Se pasa al diálogo de cobro con `aCobrar`, sin transformar nada.
 */
export type OcurrenciaDeCuenta = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  materia: { id: number; nombre: string }
  profesor: { id: number; nombre: string; apellido: string }
  estado: EstadoOcurrenciaDeCuenta
  /** Precio vigente de la materia; `null` si no tiene precio (no suma al total). */
  importe: number | null
}

/** Un pago del historial del alumno. El comprobante se abre con `pagoId`. */
export type PagoDelHistorial = {
  pagoId: number
  numeroComprobante: number
  fechaPago: string
  /** Cantidad de turnos pagados. */
  cantidad: number
  total: number
}

/** `GET /cuentas/alumnos/{alumnoId}`. */
export type CuentaDelAlumno = {
  /** Suma de los importes de `adeudados` (los `null` no suman). */
  totalAdeudado: number
  /** Pagos con `fechaPago` del día 1 del mes de hoy a hoy. */
  pagadoDelMes: number
  /** Anteriores a hoy, sin registrar e impagas: de la más antigua a la más reciente. */
  adeudados: OcurrenciaDeCuenta[]
  /** Agendadas e impagas de hoy a hoy + 56 días, en el mismo orden. No suman a la deuda. */
  proximos: OcurrenciaDeCuenta[]
  /** Todos los pagos, sin paginar, del más reciente al más antiguo. */
  pagos: PagoDelHistorial[]
}

/** Un adeudado de la vista global: la ocurrencia con su alumno. */
export type AdeudadoGlobal = OcurrenciaDeCuenta & {
  alumno: { id: number; nombre: string; apellido: string; dni: string }
}

/**
 * `GET /cuentas/adeudados`: la página y `totalAdeudado` de **todos** los adeudados del filtro, junto
 * a `data` y `meta` (no dentro de `meta`, T-70).
 */
export type AdeudadosGlobal = PaginatedResponse<AdeudadoGlobal> & { totalAdeudado: number }

/** Query de `GET /cuentas/adeudados`. Sin `pageSize`: se usa el de la API. */
export type ListarAdeudadosParams = {
  alumnoId?: number
  page: number
}
