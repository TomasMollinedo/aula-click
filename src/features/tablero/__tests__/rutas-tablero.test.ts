import { describe, expect, it } from 'vitest'

import { hrefPdfTablero } from '../rutas-tablero'

describe('hrefPdfTablero', () => {
  it('manda el período que se ve, con los dos extremos', () => {
    expect(hrefPdfTablero({ desde: '2026-09-28', hasta: '2026-10-04' })).toBe(
      '/api/v1/tablero/pdf?desde=2026-09-28&hasta=2026-10-04',
    )
  })

  it('un solo día', () => {
    expect(hrefPdfTablero({ desde: '2026-10-02', hasta: '2026-10-02' })).toBe(
      '/api/v1/tablero/pdf?desde=2026-10-02&hasta=2026-10-02',
    )
  })
})
