import { describe, expect, it } from 'vitest'

import {
  bloqueAValoresForm,
  bloqueFormSchema,
  parsearParamBloque,
  valoresFormACrearBloque,
  valoresFormAEditarBloque,
} from '../profesores.schema'
import type { Bloque } from '../profesores.types'

const ACTUAL: Bloque = {
  id: 10,
  diaSemana: 1,
  horaInicio: '08:00',
  horaFin: '09:00',
  aula: { id: 3, nombre: 'Aula 3' },
}

const VALIDO = { diaSemana: '1', horaInicio: '08:00', horaFin: '12:00', aulaId: '3' }

describe('bloqueFormSchema', () => {
  it('acepta un rango de horas en punto con el fin posterior', () => {
    expect(bloqueFormSchema.safeParse(VALIDO).success).toBe(true)
  })

  it.each([
    ['día vacío', { ...VALIDO, diaSemana: '' }, 'diaSemana'],
    ['día fuera de rango', { ...VALIDO, diaSemana: '8' }, 'diaSemana'],
    ['hora que no es en punto', { ...VALIDO, horaInicio: '08:30' }, 'horaInicio'],
    ['hora vacía', { ...VALIDO, horaFin: '' }, 'horaFin'],
    ['fin igual al inicio', { ...VALIDO, horaFin: '08:00' }, 'horaFin'],
    ['fin anterior al inicio', { ...VALIDO, horaInicio: '12:00', horaFin: '08:00' }, 'horaFin'],
    ['sin aula', { ...VALIDO, aulaId: '' }, 'aulaId'],
  ])('%s → error en %s', (_caso, valores, campo) => {
    const resultado = bloqueFormSchema.safeParse(valores)
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues.map((i) => i.path[0])).toContain(campo)
  })
})

describe('conversiones', () => {
  it('la fila a valores del formulario', () => {
    expect(bloqueAValoresForm(ACTUAL)).toEqual({
      diaSemana: '1',
      horaInicio: '08:00',
      horaFin: '09:00',
      aulaId: '3',
    })
  })

  it('el alta pasa día y aula a número', () => {
    expect(valoresFormACrearBloque(VALIDO)).toEqual({
      diaSemana: 1,
      horaInicio: '08:00',
      horaFin: '12:00',
      aulaId: 3,
    })
  })

  it('la edición manda solo lo que cambió', () => {
    expect(
      valoresFormAEditarBloque({ ...bloqueAValoresForm(ACTUAL), aulaId: '5' }, ACTUAL),
    ).toEqual({ aulaId: 5 })
    expect(
      valoresFormAEditarBloque({ ...bloqueAValoresForm(ACTUAL), diaSemana: '2' }, ACTUAL),
    ).toEqual({ diaSemana: 2 })
  })

  it('si cambia el horario, manda las dos horas', () => {
    const valores = { ...bloqueAValoresForm(ACTUAL), horaInicio: '10:00', horaFin: '11:00' }
    expect(valoresFormAEditarBloque(valores, ACTUAL)).toEqual({
      horaInicio: '10:00',
      horaFin: '11:00',
    })
  })

  it('sin cambios devuelve null', () => {
    expect(valoresFormAEditarBloque(bloqueAValoresForm(ACTUAL), ACTUAL)).toBeNull()
  })
})

describe('parsearParamBloque', () => {
  it.each([
    ['nuevo', 'nuevo'],
    ['10', 10],
    [null, null],
    ['', null],
    ['0', null],
    ['-3', null],
    ['1.5', null],
    ['abc', null],
  ])('%o → %o', (valor, esperado) => {
    expect(parsearParamBloque(valor)).toBe(esperado)
  })
})
