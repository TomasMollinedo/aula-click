import { describe, expect, it } from 'vitest'
import {
  nombreArchivoCaja,
  textoHoraDeRegistro,
  textoImporteConSigno,
  textoMovimiento,
  textoSinMovimientos,
} from '../caja.formato'
import type { Movimiento } from '../caja.reglas'

// Los textos de la caja en PDF (T-127): funciones puras.

const ALUMNO = { id: 12, nombre: 'Juan', apellido: 'Pérez' }
const EFECTIVO = { codigo: 'EFECTIVO', nombre: 'Efectivo' } as const

const COBRO: Movimiento = {
  tipo: 'COBRO',
  registradoEl: '2026-10-15T13:00:00.000Z',
  pagoId: 31,
  numeroComprobante: 1024,
  alumno: ALUMNO,
  formaPago: EFECTIVO,
  importe: 8000,
  estado: 'VIGENTE',
}

describe('textoHoraDeRegistro', () => {
  it('el día de la caja, sólo la hora de Salta', () => {
    expect(textoHoraDeRegistro('2026-10-15T12:12:00.000Z', '2026-10-15')).toBe('09:12')
  })

  it('otro día (un pago cargado hacia atrás): fecha y hora', () => {
    expect(textoHoraDeRegistro('2026-10-16T12:12:00.000Z', '2026-10-15')).toBe('16/10 09:12')
  })

  it('el día lo da la hora de Salta, no la UTC', () => {
    // 15/10 22:30 en Salta es el 16/10 01:30 UTC.
    expect(textoHoraDeRegistro('2026-10-16T01:30:00.000Z', '2026-10-15')).toBe('22:30')
  })
})

describe('textoImporteConSigno', () => {
  it('un cobro suma', () => {
    expect(textoImporteConSigno(COBRO)).toBe('+ $ 8.000,00')
  })

  it.each(['ANULACION', 'PAGO_PROFESOR'] as const)('%s resta, con el signo menos', (tipo) => {
    expect(textoImporteConSigno({ tipo, importe: 6800.5 })).toBe('− $ 6.800,50')
  })
})

describe('textoMovimiento', () => {
  it('cobro', () => {
    expect(textoMovimiento(COBRO)).toBe('Cobro · Comprobante N° 1024 · Pérez, Juan')
  })

  it('cobro anulado después', () => {
    expect(textoMovimiento({ ...COBRO, estado: 'ANULADO' } as Movimiento)).toBe(
      'Cobro · Comprobante N° 1024 · Pérez, Juan · Anulado',
    )
  })

  it('anulación con y sin detalle', () => {
    const anulacion: Movimiento = {
      tipo: 'ANULACION',
      registradoEl: '2026-10-15T14:00:00.000Z',
      pagoId: 31,
      numeroComprobante: 1024,
      alumno: ALUMNO,
      formaPago: EFECTIVO,
      importe: 8000,
      motivo: 'ERROR_CARGA',
      detalle: 'Se cargó dos veces',
    }

    expect(textoMovimiento(anulacion)).toBe(
      'Anulación · Comprobante N° 1024 · Pérez, Juan · Error de carga: Se cargó dos veces',
    )
    expect(textoMovimiento({ ...anulacion, motivo: 'FORMA_PAGO_EQUIVOCADA', detalle: null })).toBe(
      'Anulación · Comprobante N° 1024 · Pérez, Juan · Forma de pago equivocada',
    )
  })

  it('pago a un profesor, con el mes escrito y la operación', () => {
    const pago: Movimiento = {
      tipo: 'PAGO_PROFESOR',
      registradoEl: '2026-10-15T15:00:00.000Z',
      profesor: { id: 4, nombre: 'Ana', apellido: 'Gómez' },
      mes: '2026-09',
      numeroOperacion: '0048213',
      formaPago: { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
      importe: 6800,
      liquidacion: { profesorId: 4, mes: '2026-09' },
    }

    expect(textoMovimiento(pago)).toBe(
      'Pago a profesor · Gómez, Ana · septiembre de 2026 · Operación 0048213',
    )
    expect(textoMovimiento({ ...pago, numeroOperacion: null })).toBe(
      'Pago a profesor · Gómez, Ana · septiembre de 2026',
    )
  })
})

describe('textoSinMovimientos y nombreArchivoCaja', () => {
  it('el aviso del día vacío', () => {
    expect(textoSinMovimientos('2026-10-15')).toBe('No hubo movimientos de caja el 15/10')
  })

  it('el nombre del archivo lleva la fecha, con guiones', () => {
    expect(nombreArchivoCaja('2026-10-15')).toBe('caja-2026-10-15')
  })
})
