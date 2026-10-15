import { describe, expect, it } from 'vitest'

import {
  etiquetaMotivoCancelacion,
  nombreProfesor,
  textoHoras,
  textoPeriodo,
  tituloBloque,
  tituloGrupo,
} from '../formato-historiales'

// Los textos del historial académico (T-109). Sin reglas: los bloques, sus horas y su orden los
// manda la API.

describe('tituloGrupo', () => {
  it('la materia y el profesor, como los nombra HU-31', () => {
    expect(
      tituloGrupo({
        materia: { id: 3, nombre: 'Matemática' },
        profesor: { id: 4, nombre: 'Ana', apellido: 'Pérez' },
      }),
    ).toBe('Matemática — Prof. Pérez')
  })
})

describe('nombreProfesor', () => {
  it('apellido y nombre, como en el resto de los selectores', () => {
    expect(nombreProfesor({ nombre: 'Ana', apellido: 'Pérez' })).toBe('Pérez, Ana')
  })
})

describe('textoHoras', () => {
  it('la cantidad de clases del bloque', () => {
    expect(textoHoras(1)).toBe('1 h')
    expect(textoHoras(3)).toBe('3 h')
  })
})

describe('tituloBloque', () => {
  it('fecha, horario y cantidad de horas', () => {
    expect(
      tituloBloque({ fecha: '2026-10-13', horaInicio: '08:00', horaFin: '10:00', horas: 2 }),
    ).toBe('martes 13/10 · 8:00 a 10:00 · 2 h')
  })

  it('una hora suelta', () => {
    expect(
      tituloBloque({ fecha: '2026-10-06', horaInicio: '09:00', horaFin: '10:00', horas: 1 }),
    ).toBe('martes 06/10 · 9:00 a 10:00 · 1 h')
  })
})

describe('textoPeriodo', () => {
  it('el período que devolvió la API', () => {
    expect(textoPeriodo('2026-10-01', '2026-10-31')).toBe('del jueves 01/10 al sábado 31/10')
  })

  it('un solo día', () => {
    expect(textoPeriodo('2026-10-15', '2026-10-15')).toBe('del jueves 15/10')
  })
})

describe('etiquetaMotivoCancelacion', () => {
  it('la misma lista que la API', () => {
    expect(etiquetaMotivoCancelacion('CANCELACION_ALUMNO')).toBe('Cancelación por el alumno')
    expect(etiquetaMotivoCancelacion('CANCELACION_PROFESOR')).toBe('Cancelación por el profesor')
    expect(etiquetaMotivoCancelacion('PROBLEMA_ADMINISTRATIVO')).toBe('Problema administrativo')
    expect(etiquetaMotivoCancelacion('OTRO')).toBe('Otro')
  })
})
