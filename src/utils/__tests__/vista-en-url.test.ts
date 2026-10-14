import { describe, expect, it } from 'vitest'

import { leerVista, paramsConVista } from '../vista-en-url'

const VISTAS = ['por-cobrar', 'realizados'] as const

describe('leerVista', () => {
  it('lee la subpestaña de la URL', () => {
    expect(leerVista(new URLSearchParams('vista=realizados'), VISTAS, 'por-cobrar')).toBe(
      'realizados',
    )
  })

  it.each([
    ['sin vista', 'tab=pagos'],
    ['una vista desconocida', 'vista=otra'],
    ['una vista vacía', 'vista='],
  ])('%s → la que va por defecto', (_caso, query) => {
    expect(leerVista(new URLSearchParams(query), VISTAS, 'por-cobrar')).toBe('por-cobrar')
  })
})

describe('paramsConVista', () => {
  const opciones = { porDefecto: 'por-cobrar', conservar: ['tab'] } as const

  it('escribe la subpestaña y conserva solo lo indicado: los filtros se van', () => {
    const params = new URLSearchParams('tab=pagos&desde=2026-10-01&materiaId=3&pageAdeudados=2')
    expect(paramsConVista(params, 'realizados', opciones).toString()).toBe(
      'tab=pagos&vista=realizados',
    )
  })

  it('no escribe la subpestaña por defecto', () => {
    const params = new URLSearchParams('tab=pagos&vista=realizados&desde=2026-10-01')
    expect(paramsConVista(params, 'por-cobrar', opciones).toString()).toBe('tab=pagos')
  })

  it('sin nada que conservar, queda solo la vista (o nada)', () => {
    const params = new URLSearchParams('vista=realizados&pago=4&alumnoId=2')
    const sin = { porDefecto: 'por-cobrar', conservar: [] } as const
    expect(paramsConVista(params, 'realizados', sin).toString()).toBe('vista=realizados')
    expect(paramsConVista(params, 'por-cobrar', sin).toString()).toBe('')
  })

  it('no inventa un parámetro conservado que la URL no tiene', () => {
    expect(paramsConVista(new URLSearchParams(), 'realizados', opciones).toString()).toBe(
      'vista=realizados',
    )
  })
})
