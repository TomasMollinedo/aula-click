import { describe, expect, it } from 'vitest'
import {
  armarMovimientos,
  armarResumen,
  filtrarMovimientos,
  type AnulacionLeida,
  type CobroLeido,
  type PagoProfesorLeido,
} from '../caja.reglas'

// Reglas puras de la caja (T-127): el orden y el filtro de los movimientos y el resumen del día, en
// centavos. Los escenarios son los de la tarea: un cobro y su anulación el mismo día, una anulación
// de un cobro de otro día, un cobro con fecha de pago hacia atrás y dos porcentajes distintos.

const EFECTIVO = { codigo: 'EFECTIVO', nombre: 'Efectivo' } as const
const TRANSFERENCIA = { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' } as const
const DEBITO = { codigo: 'DEBITO', nombre: 'Tarjeta de débito' } as const
const JUAN = { id: 12, nombre: 'Juan', apellido: 'Pérez' }
const LUCIA = { id: 15, nombre: 'Lucía', apellido: 'González' }

let numero = 1000

function cobro(cambios: Partial<CobroLeido> = {}): CobroLeido {
  numero += 1
  return {
    pagoId: numero,
    numeroComprobante: numero,
    registradoEl: '2026-10-15T13:00:00.000Z',
    alumno: JUAN,
    formaPago: EFECTIVO,
    importe: 8000,
    turnos: [{ importe: 8000, porcentaje: 15 }],
    estado: 'VIGENTE',
    ...cambios,
  }
}

/** La anulación de `pago`: el mismo importe, forma y turnos, con la hora de la anulación. */
function anulacionDe(pago: CobroLeido, cambios: Partial<AnulacionLeida> = {}): AnulacionLeida {
  return {
    pagoId: pago.pagoId,
    numeroComprobante: pago.numeroComprobante,
    registradoEl: '2026-10-15T15:00:00.000Z',
    alumno: pago.alumno,
    formaPago: pago.formaPago,
    importe: pago.importe,
    turnos: pago.turnos,
    motivo: 'ERROR_CARGA',
    detalle: null,
    ...cambios,
  }
}

function pagoAProfesor(cambios: Partial<PagoProfesorLeido> = {}): PagoProfesorLeido {
  return {
    profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
    mes: '2026-09',
    numeroOperacion: '0048213',
    formaPago: TRANSFERENCIA,
    importe: 6800,
    registradoEl: '2026-10-15T16:00:00.000Z',
    ...cambios,
  }
}

const VACIO = { cobros: [], anulaciones: [], pagosAProfesores: [] }

describe('armarResumen', () => {
  it('un día sin movimientos → todo en 0', () => {
    expect(armarResumen(VACIO)).toStrictEqual({
      ingresos: {
        porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
        total: 0,
        parteCentro: 0,
        parteProfesores: 0,
      },
      egresos: 0,
      saldo: 0,
    })
  })

  it('separa los ingresos por forma de pago y reparte cada cobro con su porcentaje', () => {
    const resumen = armarResumen({
      ...VACIO,
      cobros: [
        cobro({ importe: 8000, turnos: [{ importe: 8000, porcentaje: 15 }] }),
        cobro({
          formaPago: TRANSFERENCIA,
          importe: 16000,
          turnos: [
            { importe: 8000, porcentaje: 15 },
            { importe: 8000, porcentaje: 15 },
          ],
        }),
        cobro({ formaPago: DEBITO, importe: 4000, turnos: [{ importe: 4000, porcentaje: 15 }] }),
      ],
    })

    expect(resumen.ingresos).toStrictEqual({
      porForma: { EFECTIVO: 8000, TRANSFERENCIA: 16000, DEBITO: 4000 },
      total: 28000,
      parteCentro: 4200,
      parteProfesores: 23800,
    })
    expect(resumen.egresos).toBe(0)
    expect(resumen.saldo).toBe(28000)
  })

  it('un cobro y su anulación el mismo día: el neto es 0, también las partes', () => {
    const pago = cobro({ estado: 'ANULADO' })

    const resumen = armarResumen({ ...VACIO, cobros: [pago], anulaciones: [anulacionDe(pago)] })

    expect(resumen.ingresos).toStrictEqual({
      porForma: { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0 },
      total: 0,
      parteCentro: 0,
      parteProfesores: 0,
    })
    expect(resumen.saldo).toBe(0)
  })

  it('una anulación de un cobro de otro día resta, con las partes de ese cobro, y puede dejar negativo', () => {
    // El cobro no está en la caja de este día: sólo su anulación.
    const delOtroDia = cobro({ importe: 8000, turnos: [{ importe: 8000, porcentaje: 12.5 }] })

    const resumen = armarResumen({ ...VACIO, anulaciones: [anulacionDe(delOtroDia)] })

    expect(resumen.ingresos).toStrictEqual({
      porForma: { EFECTIVO: -8000, TRANSFERENCIA: 0, DEBITO: 0 },
      total: -8000,
      parteCentro: -1000,
      parteProfesores: -7000,
    })
    expect(resumen.saldo).toBe(-8000)
  })

  it('un cobro con fecha de pago hacia atrás cuenta en el día de su fecha de pago', () => {
    // Se registró el 16/10 y su fecha de pago es el 15/10: el repository lo trae para el 15.
    const resumen = armarResumen({
      ...VACIO,
      cobros: [cobro({ registradoEl: '2026-10-16T12:12:00.000Z', importe: 8000 })],
    })

    expect(resumen.ingresos.total).toBe(8000)
    expect(resumen.ingresos.parteCentro).toBe(1200)
  })

  it('dos porcentajes distintos: cada cobro se reparte con el suyo y las partes suman los ingresos', () => {
    const resumen = armarResumen({
      ...VACIO,
      cobros: [
        cobro({ importe: 8000, turnos: [{ importe: 8000, porcentaje: 15 }] }),
        cobro({ importe: 8000, turnos: [{ importe: 8000, porcentaje: 20 }] }),
      ],
    })

    expect(resumen.ingresos.parteCentro).toBe(1200 + 1600)
    expect(resumen.ingresos.parteProfesores).toBe(6800 + 6400)
    expect(resumen.ingresos.parteCentro + resumen.ingresos.parteProfesores).toBe(
      resumen.ingresos.total,
    )
  })

  it('un pago con turnos a distinto porcentaje suma las partes de cada turno', () => {
    const resumen = armarResumen({
      ...VACIO,
      cobros: [
        cobro({
          importe: 16000,
          turnos: [
            { importe: 8000, porcentaje: 15 },
            { importe: 8000, porcentaje: 20 },
          ],
        }),
      ],
    })

    expect(resumen.ingresos.parteCentro).toBe(2800)
    expect(resumen.ingresos.parteProfesores).toBe(13200)
  })

  it('el redondeo de cada turno es en centavos, sin errores de coma flotante', () => {
    // $ 0,10 al 15 % → $ 0,02 para el centro (mitad hacia arriba); tres cobros: 0,06 y 0,24.
    const chico = () => cobro({ importe: 0.1, turnos: [{ importe: 0.1, porcentaje: 15 }] })

    const resumen = armarResumen({ ...VACIO, cobros: [chico(), chico(), chico()] })

    expect(resumen.ingresos).toStrictEqual({
      porForma: { EFECTIVO: 0.3, TRANSFERENCIA: 0, DEBITO: 0 },
      total: 0.3,
      parteCentro: 0.06,
      parteProfesores: 0.24,
    })
  })

  it('los egresos son lo pagado a profesores y el saldo, ingresos menos egresos', () => {
    const resumen = armarResumen({
      ...VACIO,
      cobros: [cobro({ importe: 8000 })],
      pagosAProfesores: [pagoAProfesor({ importe: 3000.5 }), pagoAProfesor({ importe: 1000.25 })],
    })

    expect(resumen.egresos).toBe(4000.75)
    expect(resumen.saldo).toBe(3999.25)
  })

  it('un pago a un profesor no toca los ingresos ni su reparto', () => {
    const resumen = armarResumen({ ...VACIO, pagosAProfesores: [pagoAProfesor()] })

    expect(resumen.ingresos.total).toBe(0)
    expect(resumen.ingresos.porForma.TRANSFERENCIA).toBe(0)
    expect(resumen.saldo).toBe(-6800)
  })
})

describe('armarMovimientos', () => {
  it('ordena por hora de registro, mezclando los tres tipos', () => {
    const pago = cobro({ registradoEl: '2026-10-15T12:00:00.000Z', estado: 'ANULADO' })

    const movimientos = armarMovimientos({
      cobros: [pago, cobro({ registradoEl: '2026-10-15T14:00:00.000Z' })],
      anulaciones: [anulacionDe(pago, { registradoEl: '2026-10-15T13:00:00.000Z' })],
      pagosAProfesores: [pagoAProfesor({ registradoEl: '2026-10-15T12:30:00.000Z' })],
    })

    expect(movimientos.map((m) => [m.tipo, m.registradoEl])).toEqual([
      ['COBRO', '2026-10-15T12:00:00.000Z'],
      ['PAGO_PROFESOR', '2026-10-15T12:30:00.000Z'],
      ['ANULACION', '2026-10-15T13:00:00.000Z'],
      ['COBRO', '2026-10-15T14:00:00.000Z'],
    ])
  })

  it('con la misma hora: cobros, después anulaciones, después pagos a profesores', () => {
    const hora = '2026-10-15T13:00:00.000Z'
    const pago = cobro({ registradoEl: hora })

    const movimientos = armarMovimientos({
      cobros: [pago],
      anulaciones: [anulacionDe(pago, { registradoEl: hora })],
      pagosAProfesores: [pagoAProfesor({ registradoEl: hora })],
    })

    expect(movimientos.map((m) => m.tipo)).toEqual(['COBRO', 'ANULACION', 'PAGO_PROFESOR'])
  })

  it('un cobro y su anulación el mismo día figuran los dos, y el cobro lleva la marca de anulado', () => {
    const pago = cobro({ estado: 'ANULADO' })

    const movimientos = armarMovimientos({
      ...VACIO,
      cobros: [pago],
      anulaciones: [anulacionDe(pago, { detalle: 'Se cargó dos veces' })],
    })

    expect(movimientos).toHaveLength(2)
    expect(movimientos[0]).toMatchObject({ tipo: 'COBRO', pagoId: pago.pagoId, estado: 'ANULADO' })
    expect(movimientos[1]).toMatchObject({
      tipo: 'ANULACION',
      pagoId: pago.pagoId,
      importe: 8000,
      motivo: 'ERROR_CARGA',
      detalle: 'Se cargó dos veces',
    })
  })

  it('un cobro con fecha de pago hacia atrás va después, por su hora de registro', () => {
    const atrasado = cobro({ registradoEl: '2026-10-16T12:12:00.000Z' })
    const delDia = cobro({ registradoEl: '2026-10-15T22:00:00.000Z' })

    const movimientos = armarMovimientos({ ...VACIO, cobros: [atrasado, delDia] })

    expect(movimientos.map((m) => m.registradoEl)).toEqual([
      '2026-10-15T22:00:00.000Z',
      '2026-10-16T12:12:00.000Z',
    ])
  })

  it('el pago a un profesor lleva la liquidación para abrirla, y es una transferencia', () => {
    const [movimiento] = armarMovimientos({ ...VACIO, pagosAProfesores: [pagoAProfesor()] })

    expect(movimiento).toStrictEqual({
      tipo: 'PAGO_PROFESOR',
      registradoEl: '2026-10-15T16:00:00.000Z',
      profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
      mes: '2026-09',
      numeroOperacion: '0048213',
      formaPago: TRANSFERENCIA,
      importe: 6800,
      liquidacion: { profesorId: 4, mes: '2026-09' },
    })
  })

  it('un día sin movimientos → lista vacía', () => {
    expect(armarMovimientos(VACIO)).toEqual([])
  })
})

describe('filtrarMovimientos', () => {
  const pago = cobro({ formaPago: EFECTIVO, estado: 'ANULADO' })
  const lecturas = {
    cobros: [pago, cobro({ formaPago: TRANSFERENCIA, alumno: LUCIA })],
    anulaciones: [anulacionDe(pago)],
    pagosAProfesores: [pagoAProfesor()],
  }
  const todos = armarMovimientos(lecturas)

  it('sin filtros devuelve todos', () => {
    expect(filtrarMovimientos(todos, {})).toHaveLength(4)
  })

  it.each([
    ['COBRO', 2],
    ['ANULACION', 1],
    ['PAGO_PROFESOR', 1],
  ] as const)('tipo %s → %i movimientos', (tipo, cantidad) => {
    const filtrados = filtrarMovimientos(todos, { tipo })

    expect(filtrados).toHaveLength(cantidad)
    expect(filtrados.every((m) => m.tipo === tipo)).toBe(true)
  })

  it('formaPago EFECTIVO → el cobro y la anulación de efectivo', () => {
    expect(filtrarMovimientos(todos, { formaPago: 'EFECTIVO' }).map((m) => m.tipo)).toEqual([
      'COBRO',
      'ANULACION',
    ])
  })

  it('formaPago TRANSFERENCIA incluye los pagos a profesores', () => {
    expect(filtrarMovimientos(todos, { formaPago: 'TRANSFERENCIA' }).map((m) => m.tipo)).toEqual([
      'COBRO',
      'PAGO_PROFESOR',
    ])
  })

  it('tipo y formaPago juntos se combinan', () => {
    const filtrados = filtrarMovimientos(todos, { tipo: 'COBRO', formaPago: 'TRANSFERENCIA' })

    expect(filtrados).toHaveLength(1)
    expect(filtrados[0]).toMatchObject({ tipo: 'COBRO', alumno: LUCIA })
  })

  it('una forma sin movimientos → lista vacía', () => {
    expect(filtrarMovimientos(todos, { formaPago: 'DEBITO' })).toEqual([])
  })

  it('no toca el resumen: se arma con las lecturas completas', () => {
    expect(armarResumen(lecturas).ingresos.total).toBe(8000)
  })
})
