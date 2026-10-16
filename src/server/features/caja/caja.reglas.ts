import { repartoDeTurno, sumarReparto } from '@/server/features/reparto/reparto.condiciones'

// Reglas puras de la caja diaria del gerente (HU-46, T-127): el orden y el filtro de los movimientos
// y el resumen del día. Sin Prisma ni `hoy()` adentro. Parten de lo que lee el repository, una lectura
// por tipo de movimiento; los importes se suman en centavos (convenciones-backend.md → Importes) y el
// reparto de cada cobro es el de `repartoDeTurno`, con el porcentaje que guardó ese cobro.

/** Los tipos de movimiento, en el orden en que desempatan dos con la misma hora de registro. */
export const TIPOS_MOVIMIENTO = ['COBRO', 'ANULACION', 'PAGO_PROFESOR'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

/** Las formas de pago, por su código fijo (`TipoFormaPago` del modelo; nunca por el nombre). */
export const FORMAS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const
export type CodigoFormaPago = (typeof FORMAS_PAGO)[number]

/** Motivos de la anulación de un pago (`MotivoAnulacion` del modelo, HU-42). */
export const MOTIVOS_ANULACION = ['ERROR_CARGA', 'FORMA_PAGO_EQUIVOCADA', 'OTRO'] as const
export type MotivoAnulacion = (typeof MOTIVOS_ANULACION)[number]

export const MENSAJE_FECHA_FUTURA = 'No se puede consultar la caja de una fecha futura'

type Persona = { id: number; nombre: string; apellido: string }
type FormaPago = { codigo: CodigoFormaPago; nombre: string }

/** Un turno de un pago: lo que se cobró por él y el porcentaje del centro de ese momento. */
export type TurnoCobrado = { importe: number; porcentaje: number }

type PagoLeido = {
  pagoId: number
  numeroComprobante: number
  /** Instante en que se registró (ISO 8601, UTC). */
  registradoEl: string
  alumno: Persona
  formaPago: FormaPago
  /** El total del pago, en pesos. */
  importe: number
  /** Los turnos del pago, también los de un pago anulado (siguen guardados). */
  turnos: TurnoCobrado[]
}

/** Un pago con `fechaPago` igual al día de la caja, vigente o anulado después. */
export type CobroLeido = PagoLeido & { estado: 'VIGENTE' | 'ANULADO' }

/** Una anulación registrada ese día, con el pago que anula. */
export type AnulacionLeida = PagoLeido & { motivo: MotivoAnulacion; detalle: string | null }

/** Una liquidación `PAGADA` con la transferencia fechada ese día. */
export type PagoProfesorLeido = {
  profesor: Persona
  /** `YYYY-MM`. */
  mes: string
  numeroOperacion: string | null
  /** Siempre `TRANSFERENCIA`: un pago a un profesor es una transferencia. */
  formaPago: FormaPago
  importe: number
  registradoEl: string
}

export type MovimientoCobro = {
  tipo: 'COBRO'
  registradoEl: string
  pagoId: number
  numeroComprobante: number
  alumno: Persona
  formaPago: FormaPago
  importe: number
  estado: 'VIGENTE' | 'ANULADO'
}

export type MovimientoAnulacion = {
  tipo: 'ANULACION'
  registradoEl: string
  pagoId: number
  numeroComprobante: number
  alumno: Persona
  formaPago: FormaPago
  importe: number
  motivo: MotivoAnulacion
  detalle: string | null
}

export type MovimientoPagoProfesor = {
  tipo: 'PAGO_PROFESOR'
  registradoEl: string
  profesor: Persona
  mes: string
  numeroOperacion: string | null
  formaPago: FormaPago
  importe: number
  liquidacion: { profesorId: number; mes: string }
}

export type Movimiento = MovimientoCobro | MovimientoAnulacion | MovimientoPagoProfesor

export type ResumenCaja = {
  ingresos: {
    /** Cobros menos anulaciones del día, por forma de pago. Puede ser negativo. */
    porForma: Record<CodigoFormaPago, number>
    total: number
    /** La parte del centro de esos ingresos, con el porcentaje guardado en cada cobro. */
    parteCentro: number
    /** La parte de los profesores de esos ingresos. `parteCentro + parteProfesores = total`. */
    parteProfesores: number
  }
  /** Pagado a profesores en el día. */
  egresos: number
  /** `ingresos.total − egresos`. */
  saldo: number
}

export type LecturasDeCaja = {
  cobros: readonly CobroLeido[]
  anulaciones: readonly AnulacionLeida[]
  pagosAProfesores: readonly PagoProfesorLeido[]
}

const aCentavos = (importe: number) => Math.round(importe * 100)

/**
 * Los movimientos del día por hora de registro, del más temprano al más tarde. Con la misma hora,
 * cobros antes que anulaciones y estas antes que los pagos a profesores; el resto conserva el orden
 * en que llegó. Un cobro con fecha de pago hacia atrás se registró otro día: su hora cae después.
 */
export function armarMovimientos({
  cobros,
  anulaciones,
  pagosAProfesores,
}: LecturasDeCaja): Movimiento[] {
  const movimientos: Movimiento[] = [
    ...cobros.map((c): MovimientoCobro => ({
      tipo: 'COBRO',
      registradoEl: c.registradoEl,
      pagoId: c.pagoId,
      numeroComprobante: c.numeroComprobante,
      alumno: c.alumno,
      formaPago: c.formaPago,
      importe: c.importe,
      estado: c.estado,
    })),
    ...anulaciones.map((a): MovimientoAnulacion => ({
      tipo: 'ANULACION',
      registradoEl: a.registradoEl,
      pagoId: a.pagoId,
      numeroComprobante: a.numeroComprobante,
      alumno: a.alumno,
      formaPago: a.formaPago,
      importe: a.importe,
      motivo: a.motivo,
      detalle: a.detalle,
    })),
    ...pagosAProfesores.map((p): MovimientoPagoProfesor => ({
      tipo: 'PAGO_PROFESOR',
      registradoEl: p.registradoEl,
      profesor: p.profesor,
      mes: p.mes,
      numeroOperacion: p.numeroOperacion,
      formaPago: p.formaPago,
      importe: p.importe,
      liquidacion: { profesorId: p.profesor.id, mes: p.mes },
    })),
  ]
  // Los instantes son ISO 8601 en UTC con el mismo formato: se ordenan como texto. `sort` es estable.
  return movimientos.sort(
    (a, b) =>
      a.registradoEl.localeCompare(b.registradoEl) ||
      TIPOS_MOVIMIENTO.indexOf(a.tipo) - TIPOS_MOVIMIENTO.indexOf(b.tipo),
  )
}

/**
 * Los movimientos de un tipo y/o de una forma de pago. Un pago a un profesor es de la forma
 * `TRANSFERENCIA`. El resumen no usa esto: es siempre el del día completo.
 */
export function filtrarMovimientos(
  movimientos: readonly Movimiento[],
  { tipo, formaPago }: { tipo?: TipoMovimiento; formaPago?: CodigoFormaPago },
): Movimiento[] {
  return movimientos.filter(
    (m) =>
      (tipo === undefined || m.tipo === tipo) &&
      (formaPago === undefined || m.formaPago.codigo === formaPago),
  )
}

/** El reparto de un pago en centavos: la suma del de cada turno, a su propio porcentaje. */
function repartoEnCentavos(turnos: readonly TurnoCobrado[]) {
  const total = sumarReparto(turnos.map((t) => repartoDeTurno(t.importe, t.porcentaje)))
  return {
    parteCentro: aCentavos(total.parteCentro),
    parteProfesor: aCentavos(total.parteProfesor),
  }
}

/**
 * El resumen del día completo: los ingresos por forma de pago (cobros menos anulaciones) y su
 * total; de ese total, la parte del centro y la de los profesores con el porcentaje guardado en
 * cada cobro (una anulación resta las partes del cobro que anula, aunque se haya cobrado otro día);
 * los egresos (lo pagado a profesores) y el saldo. Un día sin movimientos da todo en 0.
 */
export function armarResumen({
  cobros,
  anulaciones,
  pagosAProfesores,
}: LecturasDeCaja): ResumenCaja {
  const porForma: Record<CodigoFormaPago, number> = { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 }
  let parteCentro = 0
  let parteProfesores = 0

  const sumar = (pago: PagoLeido, signo: 1 | -1) => {
    porForma[pago.formaPago.codigo] += signo * aCentavos(pago.importe)
    const reparto = repartoEnCentavos(pago.turnos)
    parteCentro += signo * reparto.parteCentro
    parteProfesores += signo * reparto.parteProfesor
  }
  for (const cobro of cobros) sumar(cobro, 1)
  for (const anulacion of anulaciones) sumar(anulacion, -1)

  const total = porForma.EFECTIVO + porForma.TRANSFERENCIA + porForma.DEBITO
  const egresos = pagosAProfesores.reduce((suma, pago) => suma + aCentavos(pago.importe), 0)
  return {
    ingresos: {
      porForma: {
        EFECTIVO: porForma.EFECTIVO / 100,
        TRANSFERENCIA: porForma.TRANSFERENCIA / 100,
        DEBITO: porForma.DEBITO / 100,
      },
      total: total / 100,
      parteCentro: parteCentro / 100,
      parteProfesores: parteProfesores / 100,
    },
    egresos: egresos / 100,
    saldo: (total - egresos) / 100,
  }
}
