import { describe, expect, it } from 'vitest'

import {
  aParams,
  fechaElegible,
  hayFiltros,
  leerFiltrosCaja,
  paramsConFiltros,
  paramsSinFiltros,
  type FiltrosCaja,
} from '../filtros-caja'

// La fecha y los filtros de la caja en la URL (`?fecha=&tipo=&formaPago=`). "Hoy" se recibe: las
// funciones no leen el reloj.

const HOY = '2026-10-16'

const SIN_FILTROS: FiltrosCaja = { fecha: undefined, tipo: null, formaPago: null }

function leer(query: string) {
  return leerFiltrosCaja(new URLSearchParams(query))
}

describe('leerFiltrosCaja', () => {
  it('sin parámetros no hay fecha ni filtros: el día lo decide la API', () => {
    expect(leer('')).toEqual(SIN_FILTROS)
  })

  it('lee la fecha y los dos filtros', () => {
    expect(leer('fecha=2026-10-15&tipo=COBRO&formaPago=EFECTIVO')).toEqual({
      fecha: '2026-10-15',
      tipo: 'COBRO',
      formaPago: 'EFECTIVO',
    })
  })

  it('una fecha que no existe o está mal formada queda sin fecha', () => {
    expect(leer('fecha=2026-02-30').fecha).toBeUndefined()
    expect(leer('fecha=15/10/2026').fecha).toBeUndefined()
    expect(leer('fecha=2026-10-5').fecha).toBeUndefined()
  })

  it('una fecha futura se lee igual: la rechaza la API, no la URL', () => {
    expect(leer('fecha=2099-01-01').fecha).toBe('2099-01-01')
  })

  it('un tipo o una forma de pago que no existen son "sin filtro"', () => {
    expect(leer('tipo=cobro&formaPago=CHEQUE')).toEqual(SIN_FILTROS)
  })

  it('ignora los demás parámetros (el detalle del pago abierto)', () => {
    expect(leer('pago=31&tipo=ANULACION')).toEqual({ ...SIN_FILTROS, tipo: 'ANULACION' })
  })
})

describe('paramsConFiltros', () => {
  it('escribe la fecha y los filtros puestos', () => {
    const params = paramsConFiltros(
      new URLSearchParams(),
      { fecha: '2026-10-15', tipo: 'PAGO_PROFESOR', formaPago: 'TRANSFERENCIA' },
      HOY,
    )
    expect(params.toString()).toBe('fecha=2026-10-15&tipo=PAGO_PROFESOR&formaPago=TRANSFERENCIA')
  })

  it('el día de hoy no se escribe: sin fecha, la API devuelve la caja de hoy', () => {
    expect(
      paramsConFiltros(new URLSearchParams(), { ...SIN_FILTROS, fecha: HOY }, HOY).toString(),
    ).toBe('')
  })

  it('un filtro vacío no se escribe y saca el que estaba', () => {
    const params = paramsConFiltros(
      new URLSearchParams('tipo=COBRO&formaPago=DEBITO'),
      { ...SIN_FILTROS, fecha: '2026-10-15' },
      HOY,
    )
    expect(params.toString()).toBe('fecha=2026-10-15')
  })

  it('conserva los demás parámetros y no muta los actuales', () => {
    const actuales = new URLSearchParams('pago=31&tipo=COBRO')
    const params = paramsConFiltros(actuales, { ...SIN_FILTROS, tipo: 'ANULACION' }, HOY)
    expect(params.get('pago')).toBe('31')
    expect(params.get('tipo')).toBe('ANULACION')
    expect(actuales.get('tipo')).toBe('COBRO')
  })
})

describe('paramsSinFiltros', () => {
  it('saca tipo y forma de pago y deja el día que se está viendo', () => {
    const filtros: FiltrosCaja = { fecha: '2026-10-15', tipo: 'COBRO', formaPago: 'EFECTIVO' }
    expect(paramsSinFiltros(new URLSearchParams('pago=31'), filtros, HOY).toString()).toBe(
      'pago=31&fecha=2026-10-15',
    )
  })
})

describe('hayFiltros', () => {
  it('la fecha no es un filtro: recorrer los días no habilita "Limpiar filtros"', () => {
    expect(hayFiltros({ ...SIN_FILTROS, fecha: '2026-10-15' })).toBe(false)
  })

  it('un tipo o una forma de pago sí', () => {
    expect(hayFiltros({ ...SIN_FILTROS, tipo: 'COBRO' })).toBe(true)
    expect(hayFiltros({ ...SIN_FILTROS, formaPago: 'DEBITO' })).toBe(true)
  })
})

describe('fechaElegible', () => {
  it('un día pasado o hoy se puede elegir', () => {
    expect(fechaElegible('2026-10-15', HOY)).toBe('2026-10-15')
    expect(fechaElegible(HOY, HOY)).toBe(HOY)
  })

  it('un día futuro se recorta a hoy: la caja de mañana todavía no existe', () => {
    expect(fechaElegible('2026-10-17', HOY)).toBe(HOY)
    expect(fechaElegible('2027-01-01', HOY)).toBe(HOY)
  })
})

describe('aParams', () => {
  it('manda sólo lo que hay', () => {
    expect(aParams(SIN_FILTROS)).toEqual({})
    expect(aParams({ fecha: '2026-10-15', tipo: 'COBRO', formaPago: 'EFECTIVO' })).toEqual({
      fecha: '2026-10-15',
      tipo: 'COBRO',
      formaPago: 'EFECTIVO',
    })
  })
})
