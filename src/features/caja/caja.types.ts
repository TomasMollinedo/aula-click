// Tipos de `GET /api/v1/caja` (HU-46), según docs/contrato-api.md → Caja. La caja no se guarda: se
// arma al consultar con los cobros, las anulaciones y los pagos a profesores ya registrados, y es
// de sólo lectura. Los importes llegan en pesos y **siempre positivos** (el signo lo da el `tipo`),
// y el `resumen` es siempre el del día completo, sin los filtros de la lista: nada se suma ni se
// recalcula en el cliente.

/**
 * La forma de pago por su código fijo, el mismo de `features/pagos` (nunca por el nombre). Se
 * declara acá porque una feature de UI no importa los tipos de otra: si los valores dejaran de
 * coincidir con los de la API, no compilaría el `Record` de etiquetas de `formato-caja.ts`.
 */
export type CodigoFormaPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'

/** Las formas de pago en el orden en que se muestran (el resumen y el filtro). */
export const CODIGOS_FORMA_PAGO = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'DEBITO',
] as const satisfies readonly CodigoFormaPago[]

/** Qué fue el movimiento. `COBRO` suma; `ANULACION` y `PAGO_PROFESOR` restan. */
export type TipoMovimiento = 'COBRO' | 'ANULACION' | 'PAGO_PROFESOR'

/** Los tipos en el orden en que se muestran (el filtro), el mismo del desempate de la API. */
export const TIPOS_MOVIMIENTO = [
  'COBRO',
  'ANULACION',
  'PAGO_PROFESOR',
] as const satisfies readonly TipoMovimiento[]

/** Motivos de la anulación de un pago (HU-42). */
export type MotivoAnulacion = 'ERROR_CARGA' | 'FORMA_PAGO_EQUIVOCADA' | 'OTRO'

/** La forma de pago de un movimiento: su código fijo y su nombre del catálogo, para mostrar. */
export type FormaPagoDeMovimiento = { codigo: CodigoFormaPago; nombre: string }

export type PersonaDeMovimiento = { id: number; nombre: string; apellido: string }

type MovimientoBase = {
  /** Instante en que se registró el movimiento, ISO 8601 en UTC. */
  registradoEl: string
  formaPago: FormaPagoDeMovimiento
  /** En pesos, siempre positivo: el signo lo da el `tipo`. */
  importe: number
}

/**
 * Un pago con **fecha de pago** igual al día, también si después se anuló (ese día fue un cobro):
 * `estado` lo marca y el cobro igual figura. `importe` es el total del pago.
 */
export type MovimientoCobro = MovimientoBase & {
  tipo: 'COBRO'
  /** Abre el detalle del pago (HU-36). */
  pagoId: number
  numeroComprobante: number
  alumno: PersonaDeMovimiento
  estado: 'VIGENTE' | 'ANULADO'
}

/**
 * Una anulación **registrada** ese día, aunque el pago sea de otro: el comprobante, el alumno, la
 * forma de pago y el importe son los del pago anulado, y `registradoEl` es el de la anulación.
 */
export type MovimientoAnulacion = MovimientoBase & {
  tipo: 'ANULACION'
  /** El pago anulado, para abrir su detalle. */
  pagoId: number
  numeroComprobante: number
  alumno: PersonaDeMovimiento
  motivo: MotivoAnulacion
  /** Detalle libre de la anulación; `null` si no se cargó. */
  detalle: string | null
}

/** Una liquidación `PAGADA` con **fecha de transferencia** igual al día. */
export type MovimientoPagoProfesor = MovimientoBase & {
  tipo: 'PAGO_PROFESOR'
  profesor: PersonaDeMovimiento
  /** El mes liquidado (`YYYY-MM`). */
  mes: string
  /** El de la transferencia; `null` si no se cargó. */
  numeroOperacion: string | null
  /** Identifica la liquidación para abrirla (HU-44). */
  liquidacion: { profesorId: number; mes: string }
}

/** Una unión por `tipo`: cada movimiento trae lo propio del suyo. */
export type Movimiento = MovimientoCobro | MovimientoAnulacion | MovimientoPagoProfesor

/**
 * El resumen del día completo, en pesos, tal como lo manda la API. `ingresos.total` y `saldo`
 * pueden ser negativos (la anulación de un cobro de otro día resta en el día en que se anula), y
 * siempre `parteCentro + parteProfesores = total`.
 */
export type ResumenCaja = {
  ingresos: {
    /** Cobros menos anulaciones del día; las tres claves vienen siempre, con `0` si no hubo. */
    porForma: Record<CodigoFormaPago, number>
    total: number
    /** De `total`, la parte del centro, con el porcentaje guardado en cada cobro. */
    parteCentro: number
    parteProfesores: number
  }
  /** Lo pagado a profesores en el día. */
  egresos: number
  /** `ingresos.total − egresos`. */
  saldo: number
}

/** Respuesta de `GET /caja`. Un día sin movimientos es 200 con la lista vacía y todo en 0. */
export type Caja = {
  /** El día de la caja: el pedido o, sin `fecha`, el de hoy en la zona del negocio. */
  fecha: string
  /** Ya recortados por `tipo` y `formaPago`. */
  movimientos: Movimiento[]
  resumen: ResumenCaja
}

/** El query de `GET /caja`: todo opcional; sin `fecha`, la API usa la de hoy. */
export type ListarCajaParams = {
  fecha?: string
  tipo?: TipoMovimiento
  formaPago?: CodigoFormaPago
}
