import { describe, expect, it } from 'vitest'

import { leerSeccion, paramsConSeccion } from '../seccion'

// La sección del tablero en la URL (HU-39, T-113): el único lugar que conoce `?seccion=`. Lo que
// importa es que el resto de la URL (el período y el estado de las tablas) sobreviva al cambio de
// pestaña, que es justo lo que no hace `useVistaEnUrl`.

const leer = (qs: string) => leerSeccion(new URLSearchParams(qs))
const escribir = (qs: string, seccion: Parameters<typeof paramsConSeccion>[1]) =>
  paramsConSeccion(new URLSearchParams(qs), seccion).toString()

describe('leerSeccion', () => {
  it('sin parámetros, "General"', () => {
    expect(leer('')).toBe('general')
  })

  it('la sección de la URL', () => {
    expect(leer('seccion=asistencia')).toBe('asistencia')
    expect(leer('seccion=general')).toBe('general')
  })

  it('una sección desconocida o vacía cae en "General"', () => {
    expect(leer('seccion=pagos')).toBe('general')
    expect(leer('seccion=')).toBe('general')
    expect(leer('seccion=ASISTENCIA')).toBe('general')
  })

  it('no mira los demás parámetros', () => {
    expect(leer('periodo=mes&seccion=asistencia&paginaProfesores=3')).toBe('asistencia')
  })
})

describe('paramsConSeccion', () => {
  it('la sección por defecto no se escribe', () => {
    expect(escribir('', 'general')).toBe('')
    expect(escribir('seccion=asistencia', 'general')).toBe('')
  })

  it('la otra sección sí', () => {
    expect(escribir('', 'asistencia')).toBe('seccion=asistencia')
  })

  it('conserva el período y el estado de las tablas', () => {
    expect(escribir('periodo=mes&paginaProfesores=3&orden=ausencias', 'asistencia')).toBe(
      'periodo=mes&paginaProfesores=3&orden=ausencias&seccion=asistencia',
    )
    // Y al volver a "General" se van sólo la sección, no el resto.
    expect(
      escribir('periodo=rango&desde=2026-09-01&hasta=2026-09-15&seccion=asistencia', 'general'),
    ).toBe('periodo=rango&desde=2026-09-01&hasta=2026-09-15')
  })

  it('no muta los parámetros que recibe', () => {
    const actuales = new URLSearchParams('periodo=mes')
    paramsConSeccion(actuales, 'asistencia')
    expect(actuales.toString()).toBe('periodo=mes')
  })
})
