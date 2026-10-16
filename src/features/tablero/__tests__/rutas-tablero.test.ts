import { describe, expect, it } from 'vitest'

import { hrefPdfTablero } from '../rutas-tablero'

// La URL del PDF del tablero: manda el período **y la sección** que se ven (HU-39, T-113).

describe('hrefPdfTablero', () => {
  it('manda el período que se ve, con los dos extremos, y la sección', () => {
    expect(hrefPdfTablero({ desde: '2026-09-28', hasta: '2026-10-04', seccion: 'general' })).toBe(
      '/api/v1/tablero/pdf?desde=2026-09-28&hasta=2026-10-04&seccion=general',
    )
  })

  it('la pestaña "Asistencia" pide su propio documento', () => {
    expect(
      hrefPdfTablero({ desde: '2026-09-28', hasta: '2026-10-04', seccion: 'asistencia' }),
    ).toBe('/api/v1/tablero/pdf?desde=2026-09-28&hasta=2026-10-04&seccion=asistencia')
  })

  it('un solo día', () => {
    expect(hrefPdfTablero({ desde: '2026-10-02', hasta: '2026-10-02', seccion: 'general' })).toBe(
      '/api/v1/tablero/pdf?desde=2026-10-02&hasta=2026-10-02&seccion=general',
    )
  })
})
