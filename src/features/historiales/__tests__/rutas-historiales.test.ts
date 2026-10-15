import { describe, expect, it } from 'vitest'

import { hrefPdfHistorial } from '../rutas-historiales'

// La URL del PDF del historial académico (HU-32, T-110): el único lugar que la conoce. Función
// pura, como el resto de los enlaces a documentos (`features/documentos/rutas-documentos.ts`).

describe('hrefPdfHistorial', () => {
  const base = { alumnoId: 12, mes: '2026-10' }

  it('el alumno va en la ruta y el mes en el query', () => {
    expect(hrefPdfHistorial(base)).toBe('/api/v1/historiales/alumnos/12/pdf?mes=2026-10')
  })

  it('con materia y profesor filtrados, los suma', () => {
    const url = new URL(
      hrefPdfHistorial({ ...base, materiaId: 3, profesorId: 4 }),
      'http://localhost',
    )

    expect(url.pathname).toBe('/api/v1/historiales/alumnos/12/pdf')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mes: '2026-10',
      materiaId: '3',
      profesorId: '4',
    })
  })

  it('un filtro sin poner (null o ausente) no se manda', () => {
    expect(hrefPdfHistorial({ ...base, materiaId: null, profesorId: null })).toBe(
      '/api/v1/historiales/alumnos/12/pdf?mes=2026-10',
    )
    expect(hrefPdfHistorial({ ...base, profesorId: 4 })).toBe(
      '/api/v1/historiales/alumnos/12/pdf?mes=2026-10&profesorId=4',
    )
  })
})
