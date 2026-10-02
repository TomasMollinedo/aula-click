import { describe, expect, it } from 'vitest'

import type { FiltrosCuenta } from '../filtros-cuenta'
import {
  avisoDelTope,
  etiquetaTotal,
  textoFecha,
  textoFiltrosActivos,
  textoOcurrencia,
  textoPeriodo,
  textoSinPrecio,
  textoTotalAPagar,
  textoTurnosSeleccionados,
  textoSinFilas,
} from '../formato-cuentas'
import { ADEUDADOS, CUENTA } from './fixtures'

const SIN_FILTROS: FiltrosCuenta = { desde: null, hasta: null, materiaId: null, profesorId: null }
const SEPTIEMBRE = { desde: '2026-09-01', hasta: '2026-09-30' }

// Intl separa el `$` del número con un espacio duro (U+00A0).
const NBSP = ' '

describe('textoTurnosSeleccionados', () => {
  it('singular y plural', () => {
    expect(textoTurnosSeleccionados(1)).toBe('1 turno seleccionado')
    expect(textoTurnosSeleccionados(4)).toBe('4 turnos seleccionados')
  })
})

describe('textoTotalAPagar', () => {
  it('el total de la selección, con decimales', () => {
    expect(textoTotalAPagar({ total: 32000 })).toBe(`$${NBSP}32.000,00`)
    expect(textoTotalAPagar({ total: 9000.5 })).toBe(`$${NBSP}9.000,50`)
    expect(textoTotalAPagar({ total: 0 })).toBe(`$${NBSP}0,00`)
  })

  it('sin total (alguno sin precio)', () => {
    expect(textoTotalAPagar({ total: null })).toBe('Sin calcular')
  })
})

describe('textoSinPrecio', () => {
  it('cuántos turnos de la selección no tienen precio; null si todos tienen', () => {
    expect(textoSinPrecio({ sinPrecio: 0 })).toBeNull()
    expect(textoSinPrecio({ sinPrecio: 1 })).toBe('1 turno sin precio')
    expect(textoSinPrecio({ sinPrecio: 2 })).toBe('2 turnos sin precio')
  })
})

describe('textoFecha', () => {
  it('dd/MM/yyyy', () => {
    expect(textoFecha('2026-10-01')).toBe('01/10/2026')
  })
})

describe('etiquetaTotal', () => {
  it('sin período: "Total adeudado", aunque haya materia o profesor', () => {
    expect(etiquetaTotal({ desde: null, hasta: null })).toBe('Total adeudado')
    const conOtrosFiltros = { ...SIN_FILTROS, materiaId: 2, profesorId: 3 }
    expect(etiquetaTotal(conOtrosFiltros)).toBe('Total adeudado')
  })

  it('con `desde` o `hasta`: "Total adeudado del período"', () => {
    expect(etiquetaTotal(SEPTIEMBRE)).toBe('Total adeudado del período')
    expect(etiquetaTotal({ desde: '2026-09-01', hasta: null })).toBe('Total adeudado del período')
    expect(etiquetaTotal({ desde: null, hasta: '2026-09-30' })).toBe('Total adeudado del período')
  })
})

describe('textoPeriodo', () => {
  it('los dos extremos, uno solo o ninguno', () => {
    expect(textoPeriodo(SEPTIEMBRE)).toBe('Del 01/09/2026 al 30/09/2026')
    expect(textoPeriodo({ desde: '2026-09-01', hasta: null })).toBe('Desde el 01/09/2026')
    expect(textoPeriodo({ desde: null, hasta: '2026-09-30' })).toBe('Hasta el 30/09/2026')
    expect(textoPeriodo({ desde: null, hasta: null })).toBeNull()
  })
})

describe('textoFiltrosActivos', () => {
  it('período, materia y profesor, en ese orden', () => {
    expect(
      textoFiltrosActivos({ ...SEPTIEMBRE, materia: 'Matemática', profesor: 'Ana Gómez' }),
    ).toBe('Del 01/09/2026 al 30/09/2026 · Matemática · Prof. Ana Gómez')
  })

  it('con el alumno adelante (vista global)', () => {
    expect(
      textoFiltrosActivos({
        alumno: 'Lucía Álvarez',
        desde: '2026-09-01',
        hasta: null,
        materia: null,
        profesor: 'Ana Gómez',
      }),
    ).toBe('Lucía Álvarez · Desde el 01/09/2026 · Prof. Ana Gómez')
  })

  it('solo lo que está filtrado', () => {
    const sinPeriodo = { desde: null, hasta: null }
    expect(textoFiltrosActivos({ ...sinPeriodo, materia: 'Física', profesor: null })).toBe('Física')
    expect(textoFiltrosActivos({ ...sinPeriodo, materia: null, profesor: 'Juan Ruiz' })).toBe(
      'Prof. Juan Ruiz',
    )
    expect(textoFiltrosActivos({ ...SEPTIEMBRE, materia: null, profesor: null })).toBe(
      'Del 01/09/2026 al 30/09/2026',
    )
  })

  it('sin filtros: null', () => {
    expect(
      textoFiltrosActivos({
        alumno: null,
        desde: null,
        hasta: null,
        materia: null,
        profesor: null,
      }),
    ).toBeNull()
  })
})

describe('avisoDelTope', () => {
  const TOPE = '2026-11-26'
  const AVISO = 'Los próximos turnos se pueden cobrar hasta el 26/11/2026'

  it('el `hasta` pedido pasa el tope: avisa con la fecha de la API', () => {
    expect(avisoDelTope({ desde: '2026-10-05', hasta: '2026-12-31' }, TOPE)).toBe(AVISO)
    expect(avisoDelTope({ desde: null, hasta: '2026-11-27' }, TOPE)).toBe(AVISO)
  })

  it('el período empieza después del tope: avisa, con o sin `hasta`', () => {
    expect(avisoDelTope({ desde: '2026-12-01', hasta: '2026-12-31' }, TOPE)).toBe(AVISO)
    expect(avisoDelTope({ desde: '2026-11-27', hasta: null }, TOPE)).toBe(AVISO)
  })

  it('el período termina en el tope o antes: sin aviso', () => {
    expect(avisoDelTope({ desde: '2026-10-05', hasta: TOPE }, TOPE)).toBeNull()
    expect(avisoDelTope({ desde: TOPE, hasta: TOPE }, TOPE)).toBeNull()
    expect(avisoDelTope({ desde: '2026-10-05', hasta: '2026-10-31' }, TOPE)).toBeNull()
  })

  it('sin `hasta` y empezando antes del tope, o sin período: sin aviso', () => {
    expect(avisoDelTope({ desde: '2026-09-01', hasta: null }, TOPE)).toBeNull()
    expect(avisoDelTope({ desde: null, hasta: null }, TOPE)).toBeNull()
  })
})

describe('textoSinFilas', () => {
  it('con período: "en el período"', () => {
    const filtros = { ...SIN_FILTROS, ...SEPTIEMBRE, materiaId: 2 }
    expect(textoSinFilas('adeudados', filtros)).toBe('Sin turnos adeudados en el período')
    expect(textoSinFilas('proximos', filtros)).toBe('Sin próximos turnos en el período')
    expect(textoSinFilas('proximos', { ...SIN_FILTROS, desde: '2026-12-01' })).toBe(
      'Sin próximos turnos en el período',
    )
  })

  it('con materia o profesor, sin período: "con los filtros elegidos"', () => {
    expect(textoSinFilas('adeudados', { ...SIN_FILTROS, materiaId: 2 })).toBe(
      'Sin turnos adeudados con los filtros elegidos',
    )
    expect(textoSinFilas('proximos', { ...SIN_FILTROS, profesorId: 3 })).toBe(
      'Sin próximos turnos con los filtros elegidos',
    )
  })

  it('sin filtros: los textos de siempre', () => {
    expect(textoSinFilas('adeudados', SIN_FILTROS)).toBe('Sin turnos adeudados')
    expect(textoSinFilas('proximos', SIN_FILTROS)).toBe('Sin próximos turnos para cobrar')
  })
})

describe('textoOcurrencia', () => {
  it('fecha con día, horario y materia', () => {
    expect(textoOcurrencia(CUENTA.proximos[0])).toBe('lunes 05/10 de 9:00 a 10:00, Matemática')
  })

  it('con el alumno, solo si se pide y la fila lo trae', () => {
    const fila = ADEUDADOS.data[0]
    expect(textoOcurrencia(fila, true)).toBe(
      'Lucía Álvarez, lunes 21/09 de 9:00 a 10:00, Matemática',
    )
    expect(textoOcurrencia(fila)).toBe('lunes 21/09 de 9:00 a 10:00, Matemática')
    expect(textoOcurrencia(CUENTA.adeudados[0], true)).toBe(
      'lunes 21/09 de 9:00 a 10:00, Matemática',
    )
  })
})
