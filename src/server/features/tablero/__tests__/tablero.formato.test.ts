import { describe, expect, it } from 'vitest'
import {
  formatearCantidad,
  formatearPorcentaje,
  nombreArchivoTablero,
  nombreProfesor,
  periodoCompleto,
  textoClasesCerradas,
  textoPeriodo,
  textoRangoConDias,
  tipoDePeriodo,
  tituloTablero,
  tituloTableroAsistencia,
} from '../tablero.formato'

describe('formatearPorcentaje', () => {
  it('coma decimal y sin ceros de más; no se recorta a 100', () => {
    expect(formatearPorcentaje(33.3)).toBe('33,3 %')
    expect(formatearPorcentaje(50)).toBe('50 %')
    expect(formatearPorcentaje(0)).toBe('0 %')
    expect(formatearPorcentaje(112.5)).toBe('112,5 %')
  })
})

describe('formatearCantidad', () => {
  it('separador de miles de es-AR', () => {
    expect(formatearCantidad(48)).toBe('48')
    expect(formatearCantidad(1234)).toBe('1.234')
  })
})

describe('textoPeriodo y periodoCompleto', () => {
  it('un solo día', () => {
    expect(textoPeriodo('2026-10-02', '2026-10-02')).toBe('02/10/2026')
    expect(periodoCompleto('2026-10-02', '2026-10-02')).toBe('02/10/2026')
  })

  it('el mismo año: el año solo al final en el rótulo, en los dos en el encabezado', () => {
    expect(textoPeriodo('2026-09-28', '2026-10-04')).toBe('28/09 al 04/10/2026')
    expect(periodoCompleto('2026-09-28', '2026-10-04')).toBe('28/09/2026 al 04/10/2026')
  })

  it('años distintos: el año en los dos extremos', () => {
    expect(textoPeriodo('2026-12-28', '2027-01-03')).toBe('28/12/2026 al 03/01/2027')
  })
})

describe('nombreProfesor', () => {
  it('apellido, nombre', () => {
    expect(nombreProfesor({ apellido: 'Gómez', nombre: 'Ana' })).toBe('Gómez, Ana')
  })
})

describe('nombreArchivoTablero', () => {
  const periodo = { desde: '2026-09-28', hasta: '2026-10-04' }

  it('las dos fechas separadas por un guion bajo', () => {
    expect(nombreArchivoTablero(periodo)).toBe('tablero-2026-09-28_2026-10-04')
  })

  it('"General" (por defecto) conserva el nombre de siempre; "Asistencia" lleva el suyo', () => {
    expect(nombreArchivoTablero(periodo, 'general')).toBe('tablero-2026-09-28_2026-10-04')
    expect(nombreArchivoTablero(periodo, 'asistencia')).toBe(
      'tablero-asistencia-2026-09-28_2026-10-04',
    )
  })
})

describe('tituloTableroAsistencia', () => {
  it('según el tipo de período', () => {
    expect(tituloTableroAsistencia('2026-10-02', '2026-10-02')).toBe('Asistencia diaria')
    expect(tituloTableroAsistencia('2026-09-28', '2026-10-04')).toBe('Asistencia semanal')
    expect(tituloTableroAsistencia('2026-10-01', '2026-10-31')).toBe('Asistencia mensual')
    expect(tituloTableroAsistencia('2026-09-15', '2026-10-20')).toBe('Asistencia del período')
  })
})

describe('tipoDePeriodo y tituloTablero', () => {
  it('un solo día → diario', () => {
    expect(tipoDePeriodo('2026-10-02', '2026-10-02')).toBe('diario')
    expect(tituloTablero('2026-10-02', '2026-10-02')).toBe('Tablero diario')
  })

  it('de lunes a domingo → semanal, también cruzando de mes y de año', () => {
    expect(tituloTablero('2026-09-28', '2026-10-04')).toBe('Tablero semanal')
    expect(tipoDePeriodo('2026-12-28', '2027-01-03')).toBe('semanal')
  })

  it('una semana que no empieza en lunes, o de otra longitud, no es semanal', () => {
    expect(tipoDePeriodo('2026-09-29', '2026-10-05')).toBe('otro')
    expect(tipoDePeriodo('2026-09-28', '2026-10-03')).toBe('otro')
  })

  it('del primero al último día de un mes → mensual (con febrero bisiesto)', () => {
    expect(tituloTablero('2026-10-01', '2026-10-31')).toBe('Tablero mensual')
    expect(tipoDePeriodo('2028-02-01', '2028-02-29')).toBe('mensual')
  })

  it('un mes incompleto, o dos meses, no es mensual', () => {
    expect(tipoDePeriodo('2026-10-01', '2026-10-30')).toBe('otro')
    expect(tipoDePeriodo('2026-10-02', '2026-10-31')).toBe('otro')
    expect(tipoDePeriodo('2026-10-01', '2026-11-30')).toBe('otro')
    expect(tituloTablero('2026-09-15', '2026-10-20')).toBe('Tablero del período')
  })
})

describe('textoRangoConDias', () => {
  it('de qué día a qué día, con el día de la semana y el año', () => {
    expect(textoRangoConDias('2026-09-28', '2026-10-04')).toBe(
      'Datos del lunes 28/09/2026 al domingo 04/10/2026',
    )
  })

  it('un solo día', () => {
    expect(textoRangoConDias('2026-10-02', '2026-10-02')).toBe('Datos del viernes 02/10/2026')
  })
})

describe('textoClasesCerradas', () => {
  it('un solo día: "clases del dd/MM/yyyy"', () => {
    expect(textoClasesCerradas({ desde: '2026-10-14', hasta: '2026-10-14' })).toBe(
      'clases del 14/10/2026',
    )
  })

  it('varios días: "clases del … al …"', () => {
    expect(textoClasesCerradas({ desde: '2026-09-17', hasta: '2026-10-07' })).toBe(
      'clases del 17/09/2026 al 07/10/2026',
    )
  })
})
