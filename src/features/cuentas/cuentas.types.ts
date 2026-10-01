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

/**
 * `GET /cuentas/alumnos/{alumnoId}`. Una sección que **no aplica** al período pedido llega `null`
 * (y `[]` si aplica y no hay nada): qué parte del período le toca a cada una lo decide la API.
 */
export type CuentaDelAlumno = {
  /** Suma de los `adeudados` con todos los filtros (los `null` no suman). Los próximos nunca suman. */
  totalAdeudado: number
  /** Anteriores a hoy, sin registrar e impagas: de la más antigua a la más reciente. */
  adeudados: OcurrenciaDeCuenta[] | null
  /** Agendadas e impagas de hoy a `limiteCobro`, en el mismo orden. No suman a la deuda. */
  proximos: OcurrenciaDeCuenta[] | null
  /** Última fecha que se puede cobrar por adelantado (la del tope de `POST /pagos`). */
  limiteCobro: string
}

/** Una fila de las vistas globales (adeudados y próximos): la ocurrencia con su alumno. */
export type OcurrenciaDeCuentaGlobal = OcurrenciaDeCuenta & {
  alumno: { id: number; nombre: string; apellido: string; dni: string }
}

/**
 * `GET /cuentas/adeudados`: la página y `totalAdeudado` de **todos** los adeudados del filtro, junto
 * a `data` y `meta` (no dentro de `meta`, T-70). Con `aplica: false` va vacía y en 0.
 */
export type AdeudadosGlobal = PaginatedResponse<OcurrenciaDeCuentaGlobal> & {
  totalAdeudado: number
  aplica: boolean
}

/** `GET /cuentas/proximos`: la página, sin total (los próximos no son deuda). */
export type ProximosGlobal = PaginatedResponse<OcurrenciaDeCuentaGlobal> & {
  aplica: boolean
  limiteCobro: string
}

/** Los filtros comunes a los tres endpoints, como van en el query: sin los vacíos. */
export type FiltrosCuentaParams = {
  desde?: string
  hasta?: string
  materiaId?: number
  profesorId?: number
}

/** Query de `GET /cuentas/adeudados` y `/cuentas/proximos`. Sin `pageSize`: se usa el de la API. */
export type ListarGlobalParams = FiltrosCuentaParams & {
  alumnoId?: number
  page: number
}
