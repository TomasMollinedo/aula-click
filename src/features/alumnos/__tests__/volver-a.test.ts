import { describe, expect, it } from 'vitest'

import { hrefAltaConVuelta, parsearVolverA, rutasDeVuelta } from '../volver-a'

describe('parsearVolverA', () => {
  it('acepta solo los destinos de la lista blanca', () => {
    expect(parsearVolverA('turnos')).toBe('turnos')
  })

  it.each([
    null,
    undefined,
    '',
    'Turnos',
    '/mesa/turnos',
    'https://example.com',
    '//example.com',
    'toString',
    '__proto__',
    'constructor',
  ])('%o → null (sin redirección)', (valor) => {
    expect(parsearVolverA(valor)).toBeNull()
  })
})

describe('rutasDeVuelta', () => {
  it('turnos: al crear lleva el alumno; al cerrar, la pantalla sola', () => {
    const rutas = rutasDeVuelta('turnos', '/mesa')
    expect(rutas.alCrear(12)).toBe('/mesa/turnos?alumnoId=12')
    expect(rutas.alCerrar).toBe('/mesa/turnos')
  })
})

describe('hrefAltaConVuelta', () => {
  it('arma el link al alta con el destino', () => {
    expect(hrefAltaConVuelta('/mesa/alumnos', 'turnos')).toBe('/mesa/alumnos/nuevo?volverA=turnos')
  })
})
