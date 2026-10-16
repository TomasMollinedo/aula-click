import { describe, expect, it } from 'vitest'

import { periodoConMes, periodoConRango } from '../filtros-historial'
import { hrefPdfHistorial } from '../rutas-historiales'

// La URL del PDF del historial académico (HU-32, T-110): el único lugar que la conoce. Función
// pura, como el resto de los enlaces a documentos (`features/documentos/rutas-documentos.ts`).
// Manda el período que se ve: un mes o un rango (decisión T-163).

const MES = periodoConMes('2026-10')
const RANGO = periodoConRango(MES, { desde: '2026-09-05', hasta: '2026-10-12' })

describe('hrefPdfHistorial', () => {
  it('con un mes elegido, el alumno va en la ruta y el mes en el query', () => {
    expect(hrefPdfHistorial({ alumnoId: 12, periodo: MES })).toBe(
      '/api/v1/historiales/alumnos/12/pdf?mes=2026-10',
    )
  })

  it('con un rango, manda las dos fechas y no el mes', () => {
    expect(hrefPdfHistorial({ alumnoId: 12, periodo: RANGO })).toBe(
      '/api/v1/historiales/alumnos/12/pdf?desde=2026-09-05&hasta=2026-10-12',
    )
  })

  it('con materia y profesor filtrados, los suma', () => {
    const url = new URL(
      hrefPdfHistorial({ alumnoId: 12, periodo: MES, materiaId: 3, profesorId: 4 }),
      'http://localhost',
    )

    expect(url.pathname).toBe('/api/v1/historiales/alumnos/12/pdf')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mes: '2026-10',
      materiaId: '3',
      profesorId: '4',
    })
  })

  it('los filtros también viajan con un rango', () => {
    const url = new URL(
      hrefPdfHistorial({ alumnoId: 12, periodo: RANGO, materiaId: 3 }),
      'http://localhost',
    )

    expect(Object.fromEntries(url.searchParams)).toEqual({
      desde: '2026-09-05',
      hasta: '2026-10-12',
      materiaId: '3',
    })
  })

  it('un filtro sin poner (null o ausente) no se manda', () => {
    expect(
      hrefPdfHistorial({ alumnoId: 12, periodo: MES, materiaId: null, profesorId: null }),
    ).toBe('/api/v1/historiales/alumnos/12/pdf?mes=2026-10')
    expect(hrefPdfHistorial({ alumnoId: 12, periodo: MES, profesorId: 4 })).toBe(
      '/api/v1/historiales/alumnos/12/pdf?mes=2026-10&profesorId=4',
    )
  })
})
