import { describe, expect, it } from 'vitest'

import type { TextosDelHistorial } from '../historiales.types'
import {
  moverMes,
  parsearMes,
  textoProximoTurno,
  textosDelBloque,
  tituloDelMes,
} from '../mis-materias'

const HOY = '2026-10-15'

describe('parsearMes', () => {
  it('sin mes, el mes en curso', () => {
    expect(parsearMes(null, HOY)).toBe('2026-10')
  })

  it('acepta un mes pasado', () => {
    expect(parsearMes('2026-08', HOY)).toBe('2026-08')
  })

  it.each(['2026-13', '2026-1', 'octubre', '2026-10-01', ''])(
    '%s no es un mes: el mes en curso',
    (valor) => {
      expect(parsearMes(valor, HOY)).toBe('2026-10')
    },
  )

  it('un mes futuro cae en el mes en curso', () => {
    expect(parsearMes('2026-12', HOY)).toBe('2026-10')
  })
})

describe('moverMes', () => {
  it('va al mes anterior y al siguiente, cruzando el año', () => {
    expect(moverMes('2026-01', -1)).toBe('2025-12')
    expect(moverMes('2026-12', 1)).toBe('2027-01')
    expect(moverMes('2026-10', -1)).toBe('2026-09')
  })
})

describe('tituloDelMes', () => {
  it('el mes con mayúscula y el año', () => {
    expect(tituloDelMes('2026-10')).toBe('Octubre 2026')
  })
})

describe('textoProximoTurno', () => {
  it('fecha con su día y horario', () => {
    expect(textoProximoTurno({ fecha: '2026-10-20', horaInicio: '16:00', horaFin: '17:00' })).toBe(
      'martes 20/10 · 16:00 a 17:00',
    )
  })

  it('sin próximo turno, null', () => {
    expect(textoProximoTurno(null)).toBeNull()
  })
})

describe('textosDelBloque', () => {
  const A: TextosDelHistorial = { trabajado: 'Ecuaciones', indicaciones: 'Repasar despeje' }
  const B: TextosDelHistorial = { trabajado: 'Fracciones', indicaciones: 'Traer calculadora' }
  const clase = (
    horaInicio: string,
    estado: 'REALIZADO' | 'AUSENTE' | 'CANCELADO',
    textosPropios: TextosDelHistorial | null = null,
  ) => ({ turnoId: 1, fecha: '2026-10-11', horaInicio, horaFin: horaInicio, estado, textosPropios })
  const bloque = (textos: TextosDelHistorial | null, clases: ReturnType<typeof clase>[]) => ({
    fecha: '2026-10-11',
    horaInicio: '09:00',
    horaFin: '12:00',
    horas: clases.length,
    textos,
    clases,
  })

  it('todas con los mismos textos: una vez arriba y nada por hora', () => {
    const r = textosDelBloque(bloque(A, [clase('09:00', 'REALIZADO'), clase('10:00', 'REALIZADO')]))
    expect(r).toEqual({ arriba: A, porClase: [null, null] })
  })

  it('una con otros textos: nada arriba y cada realizada con los suyos; la ausente sin', () => {
    const r = textosDelBloque(
      bloque(A, [
        clase('09:00', 'REALIZADO'),
        clase('10:00', 'REALIZADO', B),
        clase('11:00', 'AUSENTE'),
        clase('12:00', 'REALIZADO'),
      ]),
    )
    expect(r).toEqual({ arriba: null, porClase: [A, B, null, A] })
  })

  it('textos vacíos: ni arriba ni por hora', () => {
    const vacios = { trabajado: null, indicaciones: null }
    expect(textosDelBloque(bloque(vacios, [clase('09:00', 'REALIZADO')]))).toEqual({
      arriba: null,
      porClase: [null],
    })
  })
})
