import { describe, expect, it } from 'vitest'

import {
  FILTROS_VACIOS,
  type FiltrosGlobal,
  aParams,
  aParamsGlobal,
  claveDeFiltros,
  hayFiltros,
  hayPeriodo,
  leerFiltros,
  leerPaginas,
  paramsConFiltros,
  paramsConPagina,
  paramsSinFiltros,
} from '../filtros-cuenta'

const leer = (qs: string) => leerFiltros(new URLSearchParams(qs))

const TODOS: FiltrosGlobal = {
  alumnoId: 12,
  desde: '2026-09-01',
  hasta: '2026-09-30',
  materiaId: 2,
  profesorId: 3,
}

describe('leerFiltros', () => {
  it('sin parámetros: sin filtros', () => {
    expect(leer('')).toEqual(FILTROS_VACIOS)
    expect(leer('tab=pagos')).toEqual(FILTROS_VACIOS)
  })

  it('todos los filtros de la vista global', () => {
    expect(leer('alumnoId=12&desde=2026-09-01&hasta=2026-09-30&materiaId=2&profesorId=3')).toEqual(
      TODOS,
    )
  })

  it('los de la ficha, junto al tab', () => {
    expect(leer('tab=pagos&desde=2026-09-01&materiaId=2')).toEqual({
      ...FILTROS_VACIOS,
      desde: '2026-09-01',
      materiaId: 2,
    })
  })

  it.each([
    ['desde=30/09/2026', 'otro formato'],
    ['desde=2026-9-1', 'sin ceros'],
    ['desde=2026-02-30', 'una fecha que no existe'],
    ['desde=2026-13-01', 'un mes que no existe'],
    ['desde=', 'vacía'],
    ['desde=hoy', 'texto'],
  ])('una fecha mal formada se ignora: %s (%s)', (qs) => {
    expect(leer(qs).desde).toBeNull()
  })

  it.each(['abc', '0', '-3', '1.5', '2e3', '', ' 12'])(
    'un id que no es un entero positivo se ignora: "%s"',
    (valor) => {
      const filtros = leer(new URLSearchParams({ alumnoId: valor, materiaId: valor }).toString())
      expect(filtros.alumnoId).toBeNull()
      expect(filtros.materiaId).toBeNull()
    },
  )

  it('un valor inválido no afecta a los demás', () => {
    expect(leer('desde=nada&hasta=2026-09-30&materiaId=x&profesorId=3')).toEqual({
      ...FILTROS_VACIOS,
      hasta: '2026-09-30',
      profesorId: 3,
    })
  })

  it('un `hasta` anterior a `desde` no se corrige: lo rechaza la API', () => {
    expect(leer('desde=2026-09-30&hasta=2026-09-01')).toEqual({
      ...FILTROS_VACIOS,
      desde: '2026-09-30',
      hasta: '2026-09-01',
    })
  })
})

describe('leerPaginas', () => {
  it('cada tabla con su página; sin parámetro o inválida, la 1', () => {
    const paginas = (qs: string) => leerPaginas(new URLSearchParams(qs))
    expect(paginas('pageAdeudados=3&pageProximos=2')).toEqual({ adeudados: 3, proximos: 2 })
    expect(paginas('pageProximos=4')).toEqual({ adeudados: 1, proximos: 4 })
    expect(paginas('')).toEqual({ adeudados: 1, proximos: 1 })
    expect(paginas('pageAdeudados=0&pageProximos=abc')).toEqual({ adeudados: 1, proximos: 1 })
    // El `page` de antes ya no se lee.
    expect(paginas('page=5')).toEqual({ adeudados: 1, proximos: 1 })
  })
})

describe('paramsConFiltros', () => {
  it('escribe los filtros y no escribe los vacíos', () => {
    const params = paramsConFiltros(new URLSearchParams(), {
      ...FILTROS_VACIOS,
      desde: '2026-09-01',
      materiaId: 2,
    })
    expect(params.toString()).toBe('desde=2026-09-01&materiaId=2')
  })

  it('ida y vuelta: lo que escribe es lo que lee', () => {
    expect(leerFiltros(paramsConFiltros(new URLSearchParams(), TODOS))).toEqual(TODOS)
  })

  it('conserva los demás parámetros (el tab de la ficha)', () => {
    const params = paramsConFiltros(new URLSearchParams('tab=pagos'), {
      ...FILTROS_VACIOS,
      profesorId: 3,
    })
    expect(params.get('tab')).toBe('pagos')
    expect(params.get('profesorId')).toBe('3')
  })

  it('sacar un filtro lo borra de la URL', () => {
    const params = paramsConFiltros(new URLSearchParams('alumnoId=12&materiaId=2'), {
      ...FILTROS_VACIOS,
      alumnoId: 12,
    })
    expect(params.toString()).toBe('alumnoId=12')
  })

  it('cambiar un filtro vuelve las dos tablas a la página 1', () => {
    const params = paramsConFiltros(
      new URLSearchParams('alumnoId=12&pageAdeudados=3&pageProximos=2'),
      { ...FILTROS_VACIOS, alumnoId: 12, materiaId: 2 },
    )
    expect(params.toString()).toBe('alumnoId=12&materiaId=2')
  })

  it('no modifica los parámetros que recibe', () => {
    const original = new URLSearchParams('materiaId=2&pageAdeudados=3')
    paramsConFiltros(original, FILTROS_VACIOS)
    expect(original.toString()).toBe('materiaId=2&pageAdeudados=3')
  })
})

describe('paramsConPagina', () => {
  it('escribe la página de esa tabla y no toca la otra ni los filtros', () => {
    const params = paramsConPagina(
      new URLSearchParams('alumnoId=12&pageProximos=2'),
      'adeudados',
      3,
    )
    expect(params.toString()).toBe('alumnoId=12&pageProximos=2&pageAdeudados=3')
  })

  it('la página 1 no se escribe', () => {
    const params = paramsConPagina(
      new URLSearchParams('pageAdeudados=3&pageProximos=2'),
      'proximos',
      1,
    )
    expect(params.toString()).toBe('pageAdeudados=3')
  })
})

describe('paramsSinFiltros', () => {
  it('"Limpiar filtros": saca los filtros y las páginas', () => {
    const params = paramsSinFiltros(
      new URLSearchParams(
        'alumnoId=12&desde=2026-09-01&hasta=2026-09-30&materiaId=2&profesorId=3&pageAdeudados=2&pageProximos=4',
      ),
    )
    expect(params.toString()).toBe('')
  })

  it('en la ficha queda solo el tab', () => {
    const params = paramsSinFiltros(new URLSearchParams('tab=pagos&desde=2026-09-01&materiaId=2'))
    expect(params.toString()).toBe('tab=pagos')
  })
})

describe('hayPeriodo y hayFiltros', () => {
  it('hay período con `desde` o con `hasta`', () => {
    expect(hayPeriodo({ desde: null, hasta: null })).toBe(false)
    expect(hayPeriodo({ desde: '2026-09-01', hasta: null })).toBe(true)
    expect(hayPeriodo({ desde: null, hasta: '2026-09-30' })).toBe(true)
  })

  it('hay filtros si alguno está puesto', () => {
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false)
    expect(hayFiltros({ ...FILTROS_VACIOS, alumnoId: 12 })).toBe(true)
    expect(hayFiltros({ desde: null, hasta: null, materiaId: null, profesorId: 3 })).toBe(true)
    // La ficha no mira el alumno: se le pasan los filtros sin `alumnoId`.
    expect(hayFiltros({ desde: null, hasta: null, materiaId: null, profesorId: null })).toBe(false)
  })
})

describe('aParams y aParamsGlobal', () => {
  it('sin los vacíos', () => {
    expect(aParams(FILTROS_VACIOS)).toEqual({})
    expect(aParams({ ...FILTROS_VACIOS, hasta: '2026-09-30', profesorId: 3 })).toEqual({
      hasta: '2026-09-30',
      profesorId: 3,
    })
    expect(Object.keys(aParams(FILTROS_VACIOS))).toEqual([])
  })

  it('la ficha no manda el alumno; la vista global sí, con la página', () => {
    expect(aParams(TODOS)).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      materiaId: 2,
      profesorId: 3,
    })
    expect(aParamsGlobal(TODOS, 2)).toEqual({ ...aParams(TODOS), alumnoId: 12, page: 2 })
    expect(aParamsGlobal(FILTROS_VACIOS, 1)).toEqual({ page: 1 })
  })
})

describe('claveDeFiltros', () => {
  it('cambia con cualquier filtro', () => {
    const base = claveDeFiltros(TODOS)
    expect(claveDeFiltros({ ...TODOS })).toBe(base)
    for (const cambio of [
      { alumnoId: 15 },
      { alumnoId: null },
      { desde: '2026-09-02' },
      { hasta: null },
      { materiaId: 7 },
      { profesorId: null },
    ]) {
      expect(claveDeFiltros({ ...TODOS, ...cambio })).not.toBe(base)
    }
  })

  it('no depende de las páginas: paginar no cambia la clave', () => {
    const conPaginas = new URLSearchParams('alumnoId=12&materiaId=2&pageAdeudados=3&pageProximos=2')
    const sinPaginas = new URLSearchParams('alumnoId=12&materiaId=2')
    expect(claveDeFiltros(leerFiltros(conPaginas))).toBe(claveDeFiltros(leerFiltros(sinPaginas)))
  })
})
