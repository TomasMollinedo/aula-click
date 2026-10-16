import { describe, expect, it } from 'vitest'

import {
  leerMesLiquidacion,
  mesAnterior,
  mesSiguiente,
  paramsConEstado,
  paramsConMes,
  paramsConPagina,
  paramsConProfesor,
  paramsSinFiltros,
  ultimoDiaDelMes,
} from '../mes-liquidacion'

const leer = (qs: string) => leerMesLiquidacion(new URLSearchParams(qs))

describe('leerMesLiquidacion', () => {
  it('sin parámetros: sin mes (manda la API) y la página 1', () => {
    expect(leer('')).toEqual({ mes: undefined, page: 1 })
  })

  it('un mes AAAA-MM y una página', () => {
    expect(leer('mes=2026-09&page=3')).toEqual({ mes: '2026-09', page: 3 })
  })

  it('un mes futuro se lee igual: lo rechaza la API', () => {
    expect(leer('mes=2030-01').mes).toBe('2030-01')
  })

  it.each(['2026-13', '2026-00', '2026-9', '2026-09-01', 'octubre', ''])(
    'un mes inválido (%s) es sin mes',
    (mes) => {
      expect(leer(`mes=${mes}`).mes).toBeUndefined()
    },
  )

  it.each(['0', '-1', '1.5', 'abc'])('una página inválida (%s) es la 1', (page) => {
    expect(leer(`page=${page}`).page).toBe(1)
  })

  it('el profesor de la URL', () => {
    expect(leer('mes=2026-09&profesorId=4')).toEqual({ mes: '2026-09', profesorId: 4, page: 1 })
  })

  it.each(['', '0', '-3', '1.5', 'abc'])('un profesorId inválido (%s) es sin filtro', (id) => {
    expect(leer(`profesorId=${id}`).profesorId).toBeUndefined()
  })
})

describe('el estado', () => {
  it('se lee de la URL, combinado con el profesor', () => {
    expect(leer('mes=2026-09&profesorId=4&estado=PENDIENTE_DE_PAGO')).toEqual({
      mes: '2026-09',
      profesorId: 4,
      estado: 'PENDIENTE_DE_PAGO',
      page: 1,
    })
  })

  it.each(['EN_CURSO', 'PENDIENTE_DE_PAGO', 'SALDO_A_DESCONTAR', 'PAGADA', 'DESCONTADA'])(
    'acepta %s',
    (estado) => {
      expect(leer(`estado=${estado}`).estado).toBe(estado)
    },
  )

  it.each(['', 'pagada', 'NADA', 'TODOS'])('un estado desconocido (%s) es sin filtro', (estado) => {
    expect(leer(`estado=${estado}`).estado).toBeUndefined()
  })
})

describe('paramsConEstado', () => {
  it('escribe el estado, conserva el mes y el profesor y vuelve a la página 1', () => {
    const params = paramsConEstado(new URLSearchParams('mes=2026-09&profesorId=4&page=3'), 'PAGADA')
    expect(params.get('estado')).toBe('PAGADA')
    expect(params.get('profesorId')).toBe('4')
    expect(params.get('mes')).toBe('2026-09')
    expect(params.has('page')).toBe(false)
  })

  it('null saca sólo el estado', () => {
    expect(
      paramsConEstado(
        new URLSearchParams('mes=2026-09&profesorId=4&estado=PAGADA'),
        null,
      ).toString(),
    ).toBe('mes=2026-09&profesorId=4')
  })
})

describe('paramsSinFiltros', () => {
  it('saca el profesor, el estado y la página; conserva el mes', () => {
    const params = paramsSinFiltros(
      new URLSearchParams('mes=2026-09&profesorId=4&estado=PAGADA&page=2'),
    )
    expect(params.toString()).toBe('mes=2026-09')
  })
})

describe('paramsConProfesor', () => {
  it('escribe el profesor, conserva el mes y vuelve a la página 1', () => {
    const params = paramsConProfesor(new URLSearchParams('mes=2026-09&page=3'), 4)
    expect(params.get('profesorId')).toBe('4')
    expect(params.get('mes')).toBe('2026-09')
    expect(params.has('page')).toBe(false)
  })

  it('null saca el filtro y conserva el mes', () => {
    const params = paramsConProfesor(new URLSearchParams('mes=2026-09&profesorId=4&page=2'), null)
    expect(params.toString()).toBe('mes=2026-09')
  })
})

describe('paramsConMes', () => {
  it('escribe el mes, conserva el resto y vuelve a la página 1', () => {
    const params = paramsConMes(new URLSearchParams('mes=2026-09&page=2&otro=x'), '2026-08')
    expect(params.get('mes')).toBe('2026-08')
    expect(params.get('otro')).toBe('x')
    expect(params.has('page')).toBe(false)
  })

  it('conserva el estado elegido', () => {
    expect(paramsConMes(new URLSearchParams('estado=PAGADA'), '2026-08').get('estado')).toBe(
      'PAGADA',
    )
  })

  it('conserva el profesor elegido', () => {
    expect(paramsConMes(new URLSearchParams('profesorId=4'), '2026-08').get('profesorId')).toBe('4')
  })

  it('no muta los parámetros recibidos', () => {
    const actuales = new URLSearchParams('page=2')
    paramsConMes(actuales, '2026-08')
    expect(actuales.toString()).toBe('page=2')
  })
})

describe('paramsConPagina', () => {
  it('escribe la página y conserva el mes', () => {
    expect(paramsConPagina(new URLSearchParams('mes=2026-09'), 2).toString()).toBe(
      'mes=2026-09&page=2',
    )
  })

  it('la 1 no se escribe', () => {
    expect(paramsConPagina(new URLSearchParams('mes=2026-09&page=2'), 1).toString()).toBe(
      'mes=2026-09',
    )
  })
})

describe('mesAnterior y mesSiguiente', () => {
  it('dentro del año', () => {
    expect(mesAnterior('2026-10')).toBe('2026-09')
    expect(mesSiguiente('2026-10')).toBe('2026-11')
  })

  it('cruce de año', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(mesSiguiente('2026-12')).toBe('2027-01')
  })
})

describe('ultimoDiaDelMes', () => {
  it.each([
    ['2026-10', '2026-10-31'],
    ['2026-09', '2026-09-30'],
    ['2026-12', '2026-12-31'],
    ['2026-02', '2026-02-28'],
    ['2028-02', '2028-02-29'],
  ])('%s → %s', (mes, esperado) => {
    expect(ultimoDiaDelMes(mes)).toBe(esperado)
  })
})
