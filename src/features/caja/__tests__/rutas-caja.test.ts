import { describe, expect, it } from 'vitest'

import { hrefPdfCaja } from '../rutas-caja'

// La URL del PDF de la caja: manda el día que se ve y nada más (el documento lleva la lista
// completa; los filtros los ignora la API).

describe('hrefPdfCaja', () => {
  it('manda la fecha que se está viendo', () => {
    expect(hrefPdfCaja('2026-10-15')).toBe('/api/v1/caja/pdf?fecha=2026-10-15')
  })
})
