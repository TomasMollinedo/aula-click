// Tipos compartidos del registro de un pago (T-52). Viven acá y no en `features/pagos` porque los
// usan `pagos` (el diálogo) y `cuentas` (que lo abre con `renderRegistrarPago`), y ninguna feature
// puede importar los types de otra (docs/arquitectura-frontend.md → Acciones sobre una ocurrencia).
// Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`.

/** Una ocurrencia que se ofrece cobrar, con el importe que mandó la API a quien abre el diálogo. */
export type OcurrenciaACobrar = {
  turnoId: number
  /** La fecha de la ocurrencia (definición B: la ocurrencia es `(turnoId, fecha)`). */
  fecha: string
  horaInicio: string
  horaFin: string
  materia: { id: number; nombre: string }
  profesor: { id: number; nombre: string; apellido: string }
  /** Precio vigente según la API; `null` si la materia no tiene precio (la API la rechaza con SIN_PRECIO). */
  importe: number | null
}

/**
 * Lo que recibe `RegistrarPagoDialog` y lo que `cuentas` le pasa a `renderRegistrarPago`.
 *
 * **Quien abre el diálogo guarda su propia copia de `ocurrencias` (y lo mantiene montado) mientras
 * está abierto**, hasta `onCerrar`. Registrar un pago (y también su 409) invalida las ocurrencias,
 * las cuentas y las agendas: el detalle se vuelve a pedir y su `acciones.registrarPago.visible`
 * pasa a `false`, y en `cuentas` la fila cobrada desaparece. Si quien abre deriva el diálogo de
 * esos datos, el paso de éxito (o el rechazo) desaparece antes de que se lea.
 */
export type SolicitudRegistrarPago = {
  alumnoId: number
  ocurrencias: OcurrenciaACobrar[]
  onCerrar: () => void
}
