import { describe, expect, it } from 'vitest'

import {
  FILTROS_VACIOS,
  hayFiltrosActivos,
  leerFiltros,
  paramsConFiltros,
  paramsDeEstadoYPrioridad,
} from '../filtros-agenda'

describe('hayFiltrosActivos', () => {
  it('sin filtros es false', () => {
    expect(hayFiltrosActivos(FILTROS_VACIOS)).toBe(false)
  })

  it.each([{ profesorId: 7 }, { estado: 'CANCELADO' as const }, { prioridad: 'ALTA' as const }])(
    'con %o es true',
    (filtro) => {
      expect(hayFiltrosActivos({ ...FILTROS_VACIOS, ...filtro })).toBe(true)
    },
  )
})

describe('paramsDeEstadoYPrioridad', () => {
  it('lo vacío no se manda a la API', () => {
    expect(paramsDeEstadoYPrioridad(FILTROS_VACIOS)).toEqual({
      estado: undefined,
      prioridad: undefined,
    })
  })

  it('manda estado y prioridad, y deja afuera el profesor', () => {
    expect(
      paramsDeEstadoYPrioridad({ profesorId: 7, estado: 'SIN_REGISTRAR', prioridad: 'MEDIA' }),
    ).toEqual({ estado: 'SIN_REGISTRAR', prioridad: 'MEDIA' })
  })
})

describe('leerFiltros', () => {
  it('sin parámetros no hay filtros', () => {
    expect(leerFiltros(new URLSearchParams())).toEqual(FILTROS_VACIOS)
  })

  it('lee profesor, estado y prioridad', () => {
    expect(
      leerFiltros(new URLSearchParams('profesorId=7&estado=CANCELADO&prioridad=ALTA')),
    ).toEqual({ profesorId: 7, estado: 'CANCELADO', prioridad: 'ALTA' })
  })

  it.each(['abc', '0', '-3', '1.5'])('un profesorId inválido (%s) es sin filtro', (valor) => {
    expect(leerFiltros(new URLSearchParams({ profesorId: valor })).profesorId).toBeNull()
  })

  it('un estado o una prioridad desconocidos son sin filtro', () => {
    expect(leerFiltros(new URLSearchParams('estado=ACTIVO&prioridad=URGENTE'))).toEqual(
      FILTROS_VACIOS,
    )
  })
})

describe('paramsConFiltros', () => {
  it('escribe los filtros, conserva los demás parámetros y vuelve a la página 1', () => {
    const params = paramsConFiltros(new URLSearchParams('fecha=2026-10-12&page=3'), {
      profesorId: 7,
      estado: null,
      prioridad: 'MEDIA',
    })

    expect(params.toString()).toBe('fecha=2026-10-12&profesorId=7&prioridad=MEDIA')
  })

  it('un filtro vacío se saca de la URL', () => {
    const params = paramsConFiltros(
      new URLSearchParams('estado=CANCELADO&profesorId=7&vista=semana'),
      { profesorId: null, estado: null, prioridad: null },
    )

    expect(params.toString()).toBe('vista=semana')
  })
})
