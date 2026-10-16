import { describe, expect, it } from 'vitest'

import {
  ETIQUETA_FORMA_PAGO,
  anchoDeBarra,
  formatearCantidad,
  formatearPorcentaje,
  nombreDeProfesor,
  rotuloALaFecha,
  textoClasesCerradas,
  textoMostrando,
  rotuloDelPeriodo,
  textoPeriodo,
  textoTurnos,
} from '../formato-tablero'

describe('formatearPorcentaje', () => {
  it('coma decimal y sin ceros de más', () => {
    expect(formatearPorcentaje(33.3)).toBe('33,3 %')
    expect(formatearPorcentaje(12.5)).toBe('12,5 %')
    expect(formatearPorcentaje(50)).toBe('50 %')
    expect(formatearPorcentaje(0)).toBe('0 %')
  })

  it('no se recorta a 100', () => {
    expect(formatearPorcentaje(112.5)).toBe('112,5 %')
  })
})

describe('formatearCantidad', () => {
  it('separador de miles de es-AR', () => {
    expect(formatearCantidad(0)).toBe('0')
    expect(formatearCantidad(48)).toBe('48')
    expect(formatearCantidad(1234)).toBe('1.234')
  })
})

describe('textoPeriodo', () => {
  it('un solo día', () => {
    expect(textoPeriodo('2026-10-02', '2026-10-02')).toBe('02/10/2026')
  })

  it('el mismo año: el año solo al final', () => {
    expect(textoPeriodo('2026-09-28', '2026-10-04')).toBe('28/09 al 04/10/2026')
  })

  it('años distintos: el año en los dos extremos', () => {
    expect(textoPeriodo('2026-12-28', '2027-01-03')).toBe('28/12/2026 al 03/01/2027')
  })
})

describe('rótulos', () => {
  it('el período de la respuesta', () => {
    expect(rotuloDelPeriodo({ desde: '2026-09-28', hasta: '2026-10-04' })).toBe(
      'Período: 28/09 al 04/10/2026',
    )
  })

  it('el total adeudado es a la fecha, no del período', () => {
    expect(rotuloALaFecha('2026-10-02')).toBe('A la fecha: 02/10/2026')
  })
})

describe('anchoDeBarra', () => {
  it('es relativo a la materia con más turnos', () => {
    expect(anchoDeBarra(15, 15)).toBe(100)
    expect(anchoDeBarra(9, 15)).toBe(60)
    expect(anchoDeBarra(4, 15)).toBe(27)
  })

  it('sin máximo, 0', () => {
    expect(anchoDeBarra(0, 0)).toBe(0)
  })
})

describe('nombreDeProfesor', () => {
  it('apellido, nombre', () => {
    expect(nombreDeProfesor({ apellido: 'Gómez', nombre: 'Ana' })).toBe('Gómez, Ana')
  })
})

describe('textoTurnos', () => {
  it('singular y plural', () => {
    expect(textoTurnos(1)).toBe('1 turno')
    expect(textoTurnos(15)).toBe('15 turnos')
  })
})

describe('ETIQUETA_FORMA_PAGO', () => {
  it('cada código de forma de pago con su nombre', () => {
    expect(ETIQUETA_FORMA_PAGO.EFECTIVO).toBe('Efectivo')
    expect(ETIQUETA_FORMA_PAGO.TRANSFERENCIA).toBe('Transferencia')
    expect(ETIQUETA_FORMA_PAGO.DEBITO).toBe('Débito')
  })
})

describe('textoMostrando', () => {
  const profesores = { singular: 'profesor', plural: 'profesores' }

  it('la primera página de a 10', () => {
    expect(textoMostrando({ page: 1, pageSize: 10, total: 23 }, profesores)).toBe(
      'Mostrando 1–10 de 23 profesores',
    )
  })

  it('la última página se corta en el total', () => {
    expect(textoMostrando({ page: 3, pageSize: 10, total: 23 }, profesores)).toBe(
      'Mostrando 21–23 de 23 profesores',
    )
  })

  it('una sola fila va en singular', () => {
    expect(textoMostrando({ page: 1, pageSize: 10, total: 1 }, profesores)).toBe(
      'Mostrando 1–1 de 1 profesor',
    )
  })

  it('los miles van con separador', () => {
    expect(
      textoMostrando(
        { page: 2, pageSize: 10, total: 1234 },
        { singular: 'materia', plural: 'materias' },
      ),
    ).toBe('Mostrando 11–20 de 1.234 materias')
  })
})

describe('textoClasesCerradas', () => {
  it('un solo día: "clases del dd/MM/yyyy"', () => {
    expect(textoClasesCerradas({ desde: '2026-10-14', hasta: '2026-10-14' })).toBe(
      'clases del 14/10/2026',
    )
  })

  it('varios días: "clases del … al …", con el año completo en los dos', () => {
    expect(textoClasesCerradas({ desde: '2026-09-17', hasta: '2026-10-07' })).toBe(
      'clases del 17/09/2026 al 07/10/2026',
    )
  })
})
