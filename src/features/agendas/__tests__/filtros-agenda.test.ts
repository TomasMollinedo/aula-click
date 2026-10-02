import { describe, expect, it } from 'vitest'

import {
  FILTROS_VACIOS,
  hayFiltrosActivos,
  leerFiltros,
  paramsConFiltros,
  paramsDeCanceladosYPrioridad,
} from '../filtros-agenda'

describe('hayFiltrosActivos', () => {
  it('sin filtros es false', () => {
    expect(hayFiltrosActivos(FILTROS_VACIOS)).toBe(false)
  })

  it.each([{ profesorId: 7 }, { incluirCancelados: true }, { prioridad: 'ALTA' as const }])(
    'con %o es true',
    (filtro) => {
      expect(hayFiltrosActivos({ ...FILTROS_VACIOS, ...filtro })).toBe(true)
    },
  )
})

describe('paramsDeCanceladosYPrioridad', () => {
  it('lo vacío no se manda a la API', () => {
    expect(paramsDeCanceladosYPrioridad(FILTROS_VACIOS)).toEqual({
      incluirCancelados: undefined,
      prioridad: undefined,
    })
  })

  it('manda cancelados y prioridad, y deja afuera el profesor', () => {
    expect(
      paramsDeCanceladosYPrioridad({ profesorId: 7, incluirCancelados: true, prioridad: 'MEDIA' }),
    ).toEqual({ incluirCancelados: true, prioridad: 'MEDIA' })
  })
})

describe('leerFiltros', () => {
  it('sin parámetros no hay filtros', () => {
    expect(leerFiltros(new URLSearchParams())).toEqual(FILTROS_VACIOS)
  })

  it('lee profesor, cancelados y prioridad', () => {
    expect(
      leerFiltros(new URLSearchParams('profesorId=7&incluirCancelados=true&prioridad=ALTA')),
    ).toEqual({ profesorId: 7, incluirCancelados: true, prioridad: 'ALTA' })
  })

  it.each(['abc', '0', '-3', '1.5'])('un profesorId inválido (%s) es sin filtro', (valor) => {
    expect(leerFiltros(new URLSearchParams({ profesorId: valor })).profesorId).toBeNull()
  })

  it('cancelados o prioridad desconocidos son sin filtro', () => {
    expect(leerFiltros(new URLSearchParams('incluirCancelados=si&prioridad=URGENTE'))).toEqual(
      FILTROS_VACIOS,
    )
  })
})

describe('paramsConFiltros', () => {
  it('escribe los filtros, conserva los demás parámetros y vuelve a la página 1', () => {
    const params = paramsConFiltros(new URLSearchParams('fecha=2026-10-12&page=3'), {
      profesorId: 7,
      incluirCancelados: false,
      prioridad: 'MEDIA',
    })

    expect(params.toString()).toBe('fecha=2026-10-12&profesorId=7&prioridad=MEDIA')
  })

  it('un filtro vacío se saca de la URL', () => {
    const params = paramsConFiltros(
      new URLSearchParams('incluirCancelados=true&profesorId=7&vista=semana'),
      { profesorId: null, incluirCancelados: false, prioridad: null },
    )

    expect(params.toString()).toBe('vista=semana')
  })
})
