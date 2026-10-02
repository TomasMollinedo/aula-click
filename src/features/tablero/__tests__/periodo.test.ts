import { describe, expect, it } from 'vitest'

import { leerPeriodo, paramsConPeriodo, periodoDeOpcion } from '../periodo'

// Viernes 02/10/2026: la semana va del lunes 28/09 al domingo 04/10.
const HOY = '2026-10-02'

const leer = (qs: string) => leerPeriodo(new URLSearchParams(qs), HOY)

describe('leerPeriodo', () => {
  it('sin parámetros: esta semana, de lunes a domingo', () => {
    expect(leer('')).toEqual({ opcion: 'semana', desde: '2026-09-28', hasta: '2026-10-04' })
  })

  it('hoy', () => {
    expect(leer('periodo=hoy')).toEqual({ opcion: 'hoy', desde: HOY, hasta: HOY })
  })

  it('este mes: del primero al último día', () => {
    expect(leer('periodo=mes')).toEqual({ opcion: 'mes', desde: '2026-10-01', hasta: '2026-10-31' })
    expect(leerPeriodo(new URLSearchParams('periodo=mes'), '2028-02-10')).toEqual({
      opcion: 'mes',
      desde: '2028-02-01',
      hasta: '2028-02-29',
    })
  })

  it('una semana que cruza de mes y de año', () => {
    expect(leerPeriodo(new URLSearchParams(), '2026-12-31')).toEqual({
      opcion: 'semana',
      desde: '2026-12-28',
      hasta: '2027-01-03',
    })
  })

  it('un rango con las dos fechas reales', () => {
    expect(leer('periodo=rango&desde=2026-09-01&hasta=2026-09-15')).toEqual({
      opcion: 'rango',
      desde: '2026-09-01',
      hasta: '2026-09-15',
    })
  })

  it('un rango con hasta anterior a desde no se corrige: lo rechaza la API', () => {
    expect(leer('periodo=rango&desde=2026-09-15&hasta=2026-09-01')).toEqual({
      opcion: 'rango',
      desde: '2026-09-15',
      hasta: '2026-09-01',
    })
  })

  it.each([
    ['una opción desconocida', 'periodo=ayer'],
    ['un rango sin fechas', 'periodo=rango'],
    ['un rango con una sola fecha', 'periodo=rango&desde=2026-09-01'],
    ['un rango con una fecha que no existe', 'periodo=rango&desde=2026-02-30&hasta=2026-03-01'],
    ['un rango con otro formato de fecha', 'periodo=rango&desde=01/09/2026&hasta=15/09/2026'],
    ['fechas sueltas sin la opción', 'desde=2026-09-01&hasta=2026-09-15'],
  ])('%s: cae en esta semana', (_, qs) => {
    expect(leer(qs)).toEqual({ opcion: 'semana', desde: '2026-09-28', hasta: '2026-10-04' })
  })
})

describe('periodoDeOpcion', () => {
  const actual = { desde: '2026-09-28', hasta: '2026-10-04' }

  it('las opciones fijas toman las fechas de hoy, no las actuales', () => {
    expect(periodoDeOpcion('hoy', actual, HOY)).toEqual({ opcion: 'hoy', desde: HOY, hasta: HOY })
    expect(periodoDeOpcion('mes', actual, HOY)).toEqual({
      opcion: 'mes',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    })
  })

  it('personalizado conserva las fechas que se estaban viendo', () => {
    expect(periodoDeOpcion('rango', { desde: HOY, hasta: HOY }, HOY)).toEqual({
      opcion: 'rango',
      desde: HOY,
      hasta: HOY,
    })
  })
})

describe('paramsConPeriodo', () => {
  const semana = leer('')

  it('esta semana (el valor por defecto) no se escribe', () => {
    expect(paramsConPeriodo(new URLSearchParams('periodo=mes'), semana).toString()).toBe('')
  })

  it('hoy y este mes escriben solo la opción', () => {
    expect(paramsConPeriodo(new URLSearchParams(), leer('periodo=hoy')).toString()).toBe(
      'periodo=hoy',
    )
    expect(
      paramsConPeriodo(
        new URLSearchParams('periodo=rango&desde=2026-09-01&hasta=2026-09-15'),
        leer('periodo=mes'),
      ).toString(),
    ).toBe('periodo=mes')
  })

  it('un rango escribe la opción y las dos fechas', () => {
    const rango = { opcion: 'rango' as const, desde: '2026-09-01', hasta: '2026-09-15' }
    expect(paramsConPeriodo(new URLSearchParams(), rango).toString()).toBe(
      'periodo=rango&desde=2026-09-01&hasta=2026-09-15',
    )
  })

  it('conserva los demás parámetros y no muta los actuales', () => {
    const actuales = new URLSearchParams('otro=1')
    const params = paramsConPeriodo(actuales, leer('periodo=hoy'))
    expect(params.get('otro')).toBe('1')
    expect(actuales.toString()).toBe('otro=1')
  })

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    for (const qs of [
      '',
      'periodo=hoy',
      'periodo=mes',
      'periodo=rango&desde=2026-09-01&hasta=2026-09-15',
    ]) {
      const periodo = leer(qs)
      expect(leer(paramsConPeriodo(new URLSearchParams(), periodo).toString())).toEqual(periodo)
    }
  })
})
