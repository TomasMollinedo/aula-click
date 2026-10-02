import { describe, expect, it } from 'vitest'

import { hrefPdfAgenda, hrefPdfTurno, hrefPdfTurnosAlumno } from '../rutas-documentos'

describe('hrefPdfTurno', () => {
  it('el turno y la fecha van en la ruta', () => {
    expect(hrefPdfTurno({ turnoId: 31, fecha: '2026-10-05' })).toBe(
      '/api/v1/ocurrencias/31/2026-10-05/pdf',
    )
  })
})

describe('hrefPdfTurnosAlumno', () => {
  const base = { alumnoId: 12, desde: '2026-10-01', hasta: '2026-10-31' }

  it('sin estado ni selección: el alumno y el rango', () => {
    expect(hrefPdfTurnosAlumno({ ...base, estado: null, seleccionadas: [] })).toBe(
      '/api/v1/ocurrencias/pdf?alumnoId=12&desde=2026-10-01&hasta=2026-10-31',
    )
  })

  it('con un estado elegido, lo manda', () => {
    const url = new URL(
      hrefPdfTurnosAlumno({ ...base, estado: 'SIN_REGISTRAR', seleccionadas: [] }),
      'http://localhost',
    )
    expect(url.pathname).toBe('/api/v1/ocurrencias/pdf')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      alumnoId: '12',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      estado: 'SIN_REGISTRAR',
    })
  })

  it('con turnos tildados manda `seleccion` y no `estado`', () => {
    const url = new URL(
      hrefPdfTurnosAlumno({
        ...base,
        estado: 'AGENDADO',
        seleccionadas: [
          { turnoId: 31, fecha: '2026-10-05' },
          { turnoId: 7, fecha: '2026-10-06' },
        ],
      }),
      'http://localhost',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      alumnoId: '12',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      seleccion: '31:2026-10-05,7:2026-10-06',
    })
  })
})

describe('hrefPdfAgenda', () => {
  const sinFiltros = { profesorId: 3, incluirCancelados: false, prioridad: null }

  it('la fecha y el profesor', () => {
    expect(hrefPdfAgenda({ fecha: '2026-10-02', filtros: sinFiltros })).toBe(
      '/api/v1/agendas/diaria/pdf?fecha=2026-10-02&profesorId=3',
    )
  })

  it('con cancelados y prioridad, los suma', () => {
    expect(
      hrefPdfAgenda({
        fecha: '2026-10-02',
        filtros: { profesorId: 3, incluirCancelados: true, prioridad: 'ALTA' },
      }),
    ).toBe(
      '/api/v1/agendas/diaria/pdf?fecha=2026-10-02&profesorId=3&incluirCancelados=true&prioridad=ALTA',
    )
  })

  it('sin profesor elegido no hay PDF', () => {
    expect(
      hrefPdfAgenda({ fecha: '2026-10-02', filtros: { ...sinFiltros, profesorId: null } }),
    ).toBeNull()
  })
})
