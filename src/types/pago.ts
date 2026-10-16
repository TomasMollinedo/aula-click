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

/** Estado de un pago registrado: nace `VIGENTE` y al anularlo (HU-42) pasa a `ANULADO`. */
export type EstadoPagoRegistrado = 'VIGENTE' | 'ANULADO'

/**
 * El pago que reciben las acciones del detalle del pago (`renderAcciones` de `PagoDetalle`, T-79).
 * Viene de `GET /pagos/{id}` (contrato de T-98). Vive acá y no en `features/pagos` porque lo
 * completan otras features (`anulaciones`: `AccionAnularPago`) y ninguna importa los types de otra.
 *
 * **Las acciones las decide la API**, según el rol, el estado y la forma de pago: un botón se
 * muestra cuando su acción es `true`, nunca con reglas propias del cliente (docs/arquitectura-frontend.md →
 * Acciones sobre una ocurrencia). El gerente las recibe todas en `false`.
 */
export type PagoParaAcciones = {
  id: number
  numeroComprobante: number
  estado: EstadoPagoRegistrado
  alumno: { id: number; nombre: string; apellido: string; dni: string }
  /** Importe total del pago, en pesos (lo calcula la API). */
  total: number
  /** Cantidad de turnos que incluye. */
  cantidad: number
  acciones: {
    anular: boolean
    reemplazarAdjunto: boolean
    quitarAdjunto: boolean
  }
}

/**
 * El reparto de un pago entre el centro y los profesores (HU-43), del `reparto` de `GET /pagos/{id}`
 * (solo para el gerente). Vive acá y no en `features/pagos` porque lo produce `pagos` y lo muestra
 * `reparto` (`RepartoDelPago`, por el slot `renderReparto`). Los importes y las partes los calcula
 * la API: la UI solo los muestra.
 */
export type RepartoDelPago = {
  /** Uno por turno, en el orden de `turnos` del detalle. */
  turnos: {
    turnoId: number
    /** `YYYY-MM-DD`. */
    fecha: string
    profesor: { id: number; nombre: string; apellido: string }
    importe: number
    /** El que guardó el cobro (18 = 18 %). */
    porcentaje: number
    parteCentro: number
    parteProfesor: number
  }[]
  totales: { importe: number; parteCentro: number; parteProfesor: number }
}
