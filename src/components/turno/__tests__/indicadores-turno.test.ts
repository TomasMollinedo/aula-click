import { describe, expect, it } from 'vitest'

import {
  distintivoTurno,
  ESTADO_PAGO,
  ESTADO_TURNO,
  ETIQUETA_PRIORIDAD,
  mostrarPrioridad,
  textoDiasHastaExamen,
  textoExamenCorto,
  textoExamenPrioridad,
  textoSinRegistrar,
} from '../indicadores-turno'

describe('ESTADO_TURNO', () => {
  it.each([
    ['AGENDADO', 'Agendado', 'estadoAgendado'],
    ['CANCELADO', 'Cancelado', 'estadoCancelado'],
    ['SIN_REGISTRAR', 'Sin registrar', 'estadoSinRegistrar'],
    ['REALIZADO', 'Realizado', 'estadoRealizado'],
    ['AUSENTE', 'Ausente', 'estadoAusente'],
  ] as const)('%s → %s (Badge %s)', (estado, etiqueta, variante) => {
    expect(ESTADO_TURNO[estado]).toMatchObject({ etiqueta, variante })
  })

  it('los cinco estados tienen una variante distinta', () => {
    const variantes = Object.values(ESTADO_TURNO).map((estilo) => estilo.variante)
    expect(new Set(variantes).size).toBe(5)
  })

  it('los cinco estados tienen un ícono, y ninguno se repite', () => {
    const iconos = Object.values(ESTADO_TURNO).map((estilo) => estilo.icono)
    expect(iconos.every(Boolean)).toBe(true)
    expect(new Set(iconos).size).toBe(5)
  })
})

describe('textoSinRegistrar', () => {
  it('dentro del plazo dice cuándo vence, con la fecha de la API', () => {
    expect(textoSinRegistrar({ vence: '2026-10-12', vencido: false })).toBe(
      'Sin registrar · vence el 12/10',
    )
  })

  it('vencido dice que lo cerró el sistema', () => {
    expect(textoSinRegistrar({ vence: '2026-10-05', vencido: true })).toBe(
      'Sin registrar · cerrado por el sistema',
    )
  })

  it('lee la fecha como día local (no corre al día anterior)', () => {
    expect(textoSinRegistrar({ vence: '2026-11-01', vencido: false })).toBe(
      'Sin registrar · vence el 01/11',
    )
  })

  it('usa el vencido de la API: no lo deduce de la fecha', () => {
    expect(textoSinRegistrar({ vence: '2000-01-01', vencido: false })).toBe(
      'Sin registrar · vence el 01/01',
    )
  })
})

describe('distintivoTurno', () => {
  const plazo = { vence: '2026-10-12', vencido: false }

  it.each(['AGENDADO', 'CANCELADO', 'SIN_REGISTRAR', 'REALIZADO', 'AUSENTE'] as const)(
    '%s sin opciones: el de ESTADO_TURNO',
    (estado) => {
      expect(distintivoTurno(estado)).toEqual(ESTADO_TURNO[estado])
    },
  )

  it('con plazo, "Sin registrar" cambia texto, ícono y borde punteado', () => {
    const enPlazo = distintivoTurno('SIN_REGISTRAR', { plazo })
    expect(enPlazo).toMatchObject({
      etiqueta: 'Sin registrar · vence el 12/10',
      variante: 'estadoPorVencer',
    })
    const cerrado = distintivoTurno('SIN_REGISTRAR', {
      plazo: { vence: '2026-10-05', vencido: true },
    })
    expect(cerrado).toMatchObject({
      etiqueta: 'Sin registrar · cerrado por el sistema',
      variante: 'estadoCerrado',
    })
    const iconos = [ESTADO_TURNO.SIN_REGISTRAR.icono, enPlazo?.icono, cerrado?.icono]
    expect(new Set(iconos).size).toBe(3)
  })

  it.each(['AGENDADO', 'CANCELADO', 'REALIZADO', 'AUSENTE'] as const)(
    '%s ignora el plazo',
    (estado) => {
      expect(distintivoTurno(estado, { plazo })).toEqual(ESTADO_TURNO[estado])
    },
  )

  it('"Sin registrar" sin plazo (null o ausente) queda con la palabra sola', () => {
    expect(distintivoTurno('SIN_REGISTRAR', { plazo: null })).toEqual(ESTADO_TURNO.SIN_REGISTRAR)
    expect(distintivoTurno('SIN_REGISTRAR', {})).toEqual(ESTADO_TURNO.SIN_REGISTRAR)
  })

  describe('variante sin asistencia', () => {
    it.each(['AGENDADO', 'CANCELADO'] as const)('%s se ve como siempre', (estado) => {
      expect(distintivoTurno(estado, { sinAsistencia: true })).toEqual(ESTADO_TURNO[estado])
    })

    it.each(['SIN_REGISTRAR', 'REALIZADO', 'AUSENTE'] as const)(
      '%s no lleva distintivo, con o sin plazo',
      (estado) => {
        expect(distintivoTurno(estado, { sinAsistencia: true })).toBeNull()
        expect(distintivoTurno(estado, { sinAsistencia: true, plazo })).toBeNull()
      },
    )

    it('un turno realizado se ve igual que uno pasado sin registrar: ninguno tiene distintivo', () => {
      expect(distintivoTurno('REALIZADO', { sinAsistencia: true })).toEqual(
        distintivoTurno('SIN_REGISTRAR', { sinAsistencia: true }),
      )
    })
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
      materiaNombre: 'Historia',
      fecha: '2026-12-01',
      dias: 3,
    }
    expect(textoExamenPrioridad(examen)).toBe('Examen de Historia el 01/12 (en 3 días)')
  })
})
