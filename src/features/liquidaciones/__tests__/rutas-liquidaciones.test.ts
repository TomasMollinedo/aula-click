import { describe, expect, it } from 'vitest'

import { hrefPdfLiquidacion } from '../rutas-liquidaciones'

describe('hrefPdfLiquidacion', () => {
  it('el PDF de la liquidación del profesor en el mes', () => {
    expect(hrefPdfLiquidacion({ profesorId: 4, mes: '2026-09' })).toBe(
      '/api/v1/liquidaciones/profesores/4/2026-09/pdf',
    )
  })
})
