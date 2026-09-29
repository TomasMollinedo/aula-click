import { describe, expect, it } from 'vitest'

import { FILTROS_VACIOS, leerFiltros, paramsConFiltros } from '../filtros-agenda'

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
