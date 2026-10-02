import { describe, expect, it } from 'vitest'

import {
  ESTADO_PAGO,
  ESTADO_TURNO,
  ETIQUETA_PRIORIDAD,
  mostrarPrioridad,
  textoDiasHastaExamen,
  textoExamenCorto,
  textoExamenPrioridad,
} from '../indicadores-turno'

describe('ESTADO_TURNO', () => {
  it.each([
    ['AGENDADO', 'Agendado', 'confirmado'],
    ['CANCELADO', 'Cancelado', 'cancelado'],
    ['SIN_REGISTRAR', 'Sin registrar', 'secondary'],
  ] as const)('%s → %s (Badge %s)', (estado, etiqueta, variante) => {
    expect(ESTADO_TURNO[estado]).toEqual({ etiqueta, variante })
  })
})

describe('ESTADO_PAGO', () => {
  it.each([
    ['PENDIENTE', 'Pendiente', 'pendiente'],
    ['PAGADO', 'Pagado', 'confirmado'],
  ] as const)('%s → %s (Badge %s)', (estado, etiqueta, variante) => {
    expect(ESTADO_PAGO[estado]).toEqual({ etiqueta, variante })
  })
})

describe('ETIQUETA_PRIORIDAD', () => {
  it('escribe la palabra de cada prioridad', () => {
    expect(ETIQUETA_PRIORIDAD).toEqual({ ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' })
  })
})

describe('mostrarPrioridad', () => {
  it.each(['fila', 'punto', 'detalle'] as const)('Alta y Media se muestran en %s', (variante) => {
    expect(mostrarPrioridad('ALTA', variante)).toBe(true)
    expect(mostrarPrioridad('MEDIA', variante)).toBe(true)
  })

  it.each(['fila', 'punto'] as const)('Baja no tiene distintivo en %s', (variante) => {
    expect(mostrarPrioridad('BAJA', variante)).toBe(false)
  })

  it('Baja se lee en el detalle', () => {
    expect(mostrarPrioridad('BAJA', 'detalle')).toBe(true)
  })
})

describe('textoDiasHastaExamen', () => {
  it.each([
    [0, 'el mismo día del turno'],
    [1, 'en 1 día'],
    [5, 'en 5 días'],
    [21, 'en 21 días'],
  ])('%i → %s', (dias, texto) => {
    expect(textoDiasHastaExamen(dias)).toBe(texto)
  })
})

describe('textoExamenCorto', () => {
  it.each([
    [5, 'Examen 15/10 · en 5 días'],
    [1, 'Examen 15/10 · en 1 día'],
    [0, 'Examen 15/10 · el mismo día'],
  ])('con %i días: %s', (dias, texto) => {
    expect(textoExamenCorto({ materiaNombre: 'Matemática', fecha: '2026-10-15', dias })).toBe(texto)
  })
})

describe('textoExamenPrioridad', () => {
  it('arma el texto de la HU con los datos de la API', () => {
    expect(
      textoExamenPrioridad({ materiaNombre: 'Matemática', fecha: '2026-10-15', dias: 5 }),
    ).toBe('Examen de Matemática el 15/10 (en 5 días)')
  })

  it('usa los días que manda la API, sin recalcularlos', () => {
    expect(textoExamenPrioridad({ materiaNombre: 'Física', fecha: '2026-10-15', dias: 12 })).toBe(
      'Examen de Física el 15/10 (en 12 días)',
    )
  })

  it('un examen el mismo día del turno no dice "hoy": los días son desde el turno', () => {
    expect(textoExamenPrioridad({ materiaNombre: 'Química', fecha: '2026-10-05', dias: 0 })).toBe(
      'Examen de Química el 05/10 (el mismo día del turno)',
    )
  })

  it('lee la fecha como día local (no corre al día anterior)', () => {
    expect(textoExamenPrioridad({ materiaNombre: 'Inglés', fecha: '2026-11-01', dias: 30 })).toBe(
      'Examen de Inglés el 01/11 (en 30 días)',
    )
  })

  it('acepta el examen entero de la API (con id y tipo)', () => {
    const examen = {
      id: 7,
      tipo: 'PARCIAL',
      materiaNombre: 'Historia',
      fecha: '2026-12-01',
      dias: 3,
    }
    expect(textoExamenPrioridad(examen)).toBe('Examen de Historia el 01/12 (en 3 días)')
  })
})
