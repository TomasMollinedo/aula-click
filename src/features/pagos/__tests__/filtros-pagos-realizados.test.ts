import { describe, expect, it } from 'vitest'

import {
  ESTADOS_PAGO,
  FORMAS_PAGO,
  type FiltrosPagosRealizados,
  aParams,
  alumnoDeLosBuscadores,
  filtraPorTurno,
  filtrosPorDefecto,
  hayFiltros,
  leerFiltros,
  leerPagina,
  mesEnCurso,
  paramsConFiltros,
  paramsConPagina,
  paramsSinFiltros,
} from '../filtros-pagos-realizados'

// Los filtros de "Pagos realizados" en la URL (T-100): el único lugar que conoce los nombres de los
// parámetros. "Hoy" se recibe: ninguna función usa el reloj. El período no se valida acá (un
// `hasta` anterior al `desde` se manda y lo rechaza la API).

// Jueves 15/10/2026.
const HOY = '2026-10-15'
const GLOBAL = { conAlumno: true }
const FICHA = { conAlumno: false }

const leer = (qs: string, opciones = GLOBAL) => leerFiltros(new URLSearchParams(qs), HOY, opciones)
const escribir = (qs: string, cambios: Partial<FiltrosPagosRealizados> = {}) =>
  paramsConFiltros(
    new URLSearchParams(qs),
    { ...filtrosPorDefecto(HOY), ...cambios },
    HOY,
  ).toString()

const OCTUBRE = { desde: '2026-10-01', hasta: '2026-10-31' }

describe('mesEnCurso y filtrosPorDefecto', () => {
  it('el primer y el último día del mes de hoy, también en febrero bisiesto', () => {
    expect(mesEnCurso(HOY)).toEqual(OCTUBRE)
    expect(mesEnCurso('2024-02-10')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' })
  })

  it('sin filtros: el mes en curso, todos los estados y nada más', () => {
    expect(filtrosPorDefecto(HOY)).toEqual({
      ...OCTUBRE,
      alumnoId: null,
      materiaId: null,
      profesorId: null,
      formaPago: null,
      estado: null,
    })
  })
})

describe('leerFiltros', () => {
  it('sin parámetros: el mes en curso', () => {
    expect(leer('')).toEqual(filtrosPorDefecto(HOY))
  })

  it('lee cada parámetro', () => {
    expect(
      leer(
        'desde=2026-09-01&hasta=2026-09-15&alumnoId=12&materiaId=2&profesorId=3&formaPago=TRANSFERENCIA&estado=ANULADO',
      ),
    ).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-15',
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      formaPago: 'TRANSFERENCIA',
      estado: 'ANULADO',
    })
  })

  it.each(ESTADOS_PAGO)('acepta el estado %s', (estado) => {
    expect(leer(`estado=${estado}`).estado).toBe(estado)
  })

  it.each(FORMAS_PAGO)('acepta la forma de pago %s', (codigo) => {
    expect(leer(`formaPago=${codigo}`).formaPago).toBe(codigo)
  })

  it('un hasta anterior al desde se lee tal cual: lo valida la API', () => {
    expect(leer('desde=2026-10-31&hasta=2026-10-01')).toMatchObject({
      desde: '2026-10-31',
      hasta: '2026-10-01',
    })
  })

  it.each([
    ['solo desde', 'desde=2026-09-01'],
    ['solo hasta', 'hasta=2026-09-30'],
    ['una fecha inexistente', 'desde=2026-02-30&hasta=2026-03-10'],
    ['otro formato', 'desde=01/09/2026&hasta=2026-09-30'],
  ])('período con %s: el mes en curso', (_caso, qs) => {
    expect(leer(qs)).toMatchObject(OCTUBRE)
  })

  it.each([
    ['alumnoId', 'alumnoId=0'],
    ['alumnoId', 'alumnoId=abc'],
    ['materiaId', 'materiaId=-2'],
    ['materiaId', 'materiaId=1.5'],
    ['profesorId', 'profesorId='],
    ['formaPago', 'formaPago=CHEQUE'],
    ['formaPago', 'formaPago=efectivo'],
    ['estado', 'estado=TODOS'],
    ['estado', 'estado=vigente'],
    ['estado', 'estado=ACTIVO'],
  ] as const)('%s inválido (%s) es "sin filtro"', (campo, qs) => {
    expect(leer(qs)[campo]).toBeNull()
  })

  it('en la ficha no lee el alumno de la URL: es el de la ficha', () => {
    expect(leer('alumnoId=12&materiaId=2', FICHA)).toMatchObject({ alumnoId: null, materiaId: 2 })
  })
})

describe('leerPagina', () => {
  it.each([
    ['', 1],
    ['page=3', 3],
    ['page=0', 1],
    ['page=-1', 1],
    ['page=abc', 1],
  ])('%s → %i', (qs, page) => {
    expect(leerPagina(new URLSearchParams(qs))).toBe(page)
  })
})

describe('paramsConFiltros', () => {
  it('el mes en curso y los filtros vacíos no se escriben', () => {
    expect(escribir('')).toBe('')
  })

  it('escribe cada filtro', () => {
    expect(
      escribir('', {
        alumnoId: 12,
        materiaId: 2,
        profesorId: 3,
        formaPago: 'DEBITO',
        estado: 'VIGENTE',
      }),
    ).toBe('alumnoId=12&materiaId=2&profesorId=3&formaPago=DEBITO&estado=VIGENTE')
  })

  it('"Todos" no se escribe: volver a "Todos" saca el estado de la URL', () => {
    expect(escribir('estado=ANULADO', { estado: null })).toBe('')
  })

  it('cambiar el estado vuelve a la página 1', () => {
    expect(escribir('vista=realizados&page=4', { estado: 'ANULADO' })).toBe(
      'vista=realizados&estado=ANULADO',
    )
  })

  it('otro período se escribe con sus dos fechas, aunque cambie una sola', () => {
    expect(escribir('', { desde: '2026-10-05' })).toBe('desde=2026-10-05&hasta=2026-10-31')
    expect(escribir('', { desde: '2026-09-01', hasta: '2026-09-30' })).toBe(
      'desde=2026-09-01&hasta=2026-09-30',
    )
  })

  it('volver al mes en curso saca las fechas de la URL', () => {
    expect(escribir('desde=2026-09-01&hasta=2026-09-30', OCTUBRE)).toBe('')
  })

  it('un filtro vacío se borra', () => {
    expect(escribir('materiaId=2&formaPago=EFECTIVO', { formaPago: 'EFECTIVO' })).toBe(
      'formaPago=EFECTIVO',
    )
  })

  it('conserva tab, vista y pago', () => {
    expect(escribir('tab=pagos&vista=realizados&pago=31', { materiaId: 2 })).toBe(
      'tab=pagos&vista=realizados&pago=31&materiaId=2',
    )
  })

  it('cambiar un filtro vuelve a la página 1', () => {
    expect(escribir('vista=realizados&page=4', { profesorId: 3 })).toBe(
      'vista=realizados&profesorId=3',
    )
  })

  it('no muta los parámetros que recibe', () => {
    const params = new URLSearchParams('page=2')
    paramsConFiltros(params, filtrosPorDefecto(HOY), HOY)
    expect(params.toString()).toBe('page=2')
  })
})

describe('paramsConPagina', () => {
  it('escribe la página y conserva lo demás; la 1 no se escribe', () => {
    const params = new URLSearchParams('vista=realizados&materiaId=2&page=2')
    expect(paramsConPagina(params, 3).toString()).toBe('vista=realizados&materiaId=2&page=3')
    expect(paramsConPagina(params, 1).toString()).toBe('vista=realizados&materiaId=2')
  })
})

describe('paramsSinFiltros', () => {
  it('vuelve al mes en curso, saca el resto y la página, y conserva tab, vista y pago', () => {
    const params = new URLSearchParams(
      'tab=pagos&vista=realizados&pago=31&desde=2026-09-01&hasta=2026-09-30&alumnoId=12&materiaId=2&profesorId=3&formaPago=EFECTIVO&estado=VIGENTE&page=3',
    )
    expect(paramsSinFiltros(params, HOY).toString()).toBe('tab=pagos&vista=realizados&pago=31')
  })
})

describe('hayFiltros y filtraPorTurno', () => {
  it('sin filtros, el mes en curso no cuenta', () => {
    expect(hayFiltros(filtrosPorDefecto(HOY), HOY)).toBe(false)
  })

  it.each([
    ['otro período', { desde: '2026-09-01', hasta: '2026-09-30' }],
    ['un alumno', { alumnoId: 12 }],
    ['una materia', { materiaId: 2 }],
    ['un profesor', { profesorId: 3 }],
    ['una forma de pago', { formaPago: 'EFECTIVO' as const }],
    ['un estado', { estado: 'ANULADO' as const }],
  ])('con %s, sí', (_caso, cambios) => {
    expect(hayFiltros({ ...filtrosPorDefecto(HOY), ...cambios }, HOY)).toBe(true)
  })

  it('el total suma el pago completo solo con materia o profesor', () => {
    const base = filtrosPorDefecto(HOY)
    expect(filtraPorTurno(base)).toBe(false)
    expect(filtraPorTurno({ ...base, formaPago: 'EFECTIVO', alumnoId: 12 })).toBe(false)
    expect(filtraPorTurno({ ...base, materiaId: 2 })).toBe(true)
    expect(filtraPorTurno({ ...base, profesorId: 3 })).toBe(true)
  })
})

describe('aParams', () => {
  it('manda siempre el período (el mes en curso por defecto) y la página', () => {
    expect(aParams(filtrosPorDefecto(HOY), 1)).toEqual({ ...OCTUBRE, page: 1 })
  })

  it('manda cada filtro puesto', () => {
    expect(
      aParams(
        {
          desde: '2026-09-01',
          hasta: '2026-09-30',
          alumnoId: 12,
          materiaId: 2,
          profesorId: 3,
          formaPago: 'TRANSFERENCIA',
          estado: 'VIGENTE',
        },
        2,
      ),
    ).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      formaPago: 'TRANSFERENCIA',
      estado: 'VIGENTE',
      page: 2,
    })
  })

  it('con "Todos" no manda el estado (la API toma TODOS)', () => {
    expect(aParams(filtrosPorDefecto(HOY), 1)).not.toHaveProperty('estado')
  })

  it('en la ficha, el alumno es el de la ficha', () => {
    expect(aParams({ ...filtrosPorDefecto(HOY), alumnoId: 99 }, 1, 12)).toMatchObject({
      alumnoId: 12,
    })
    expect(aParams(leer('alumnoId=99', FICHA), 1, 12).alumnoId).toBe(12)
  })
})

describe('alumnoDeLosBuscadores (T-170)', () => {
  it('en la ficha, el de la ficha, aunque la URL traiga otro', () => {
    expect(alumnoDeLosBuscadores({ alumnoId: null }, 12)).toBe(12)
    expect(alumnoDeLosBuscadores({ alumnoId: 99 }, 12)).toBe(12)
    expect(alumnoDeLosBuscadores(leer('alumnoId=99', FICHA), 12)).toBe(12)
  })

  it('en la vista global, el elegido en el filtro', () => {
    expect(alumnoDeLosBuscadores(leer('alumnoId=27'))).toBe(27)
  })

  it('sin alumno: undefined (los buscadores no se acotan)', () => {
    expect(alumnoDeLosBuscadores(filtrosPorDefecto(HOY))).toBeUndefined()
    expect(alumnoDeLosBuscadores(leer('alumnoId=abc'))).toBeUndefined()
  })
})
