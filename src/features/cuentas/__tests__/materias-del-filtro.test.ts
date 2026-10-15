import { describe, expect, it } from 'vitest'

import {
  alternarMateria,
  filtrarMaterias,
  opcionesDeMaterias,
  textoBotonMaterias,
} from '../materias-del-filtro'

const LISTA = [
  { id: 2, nombre: 'Matemática', inactiva: false },
  { id: 5, nombre: 'Inglés', inactiva: false },
  { id: 9, nombre: 'Física Cuántica', inactiva: true },
]

describe('opcionesDeMaterias', () => {
  it('la lista tal cual si todas las elegidas están en ella', () => {
    expect(opcionesDeMaterias(LISTA, [{ id: 5, nombre: 'Inglés' }])).toEqual(LISTA)
  })

  it('una elegida fuera de la lista va primero, con su nombre (o null mientras carga)', () => {
    expect(
      opcionesDeMaterias(LISTA, [
        { id: 2, nombre: 'Matemática' },
        { id: 40, nombre: 'Latín' },
        { id: 41, nombre: null },
      ]).map((o) => [o.id, o.nombre]),
    ).toEqual([
      [40, 'Latín'],
      [41, null],
      [2, 'Matemática'],
      [5, 'Inglés'],
      [9, 'Física Cuántica'],
    ])
  })
})

describe('filtrarMaterias', () => {
  it('sin texto: todas', () => {
    expect(filtrarMaterias(LISTA, '  ')).toEqual(LISTA)
  })

  it('sin tildes ni mayúsculas, todas las palabras en cualquier orden', () => {
    expect(filtrarMaterias(LISTA, 'INGLES').map((o) => o.id)).toEqual([5])
    expect(filtrarMaterias(LISTA, 'cuant fis').map((o) => o.id)).toEqual([9])
    expect(filtrarMaterias(LISTA, 'quimica')).toEqual([])
  })
})

describe('alternarMateria', () => {
  it('tilda una que no estaba, sin repetir y de menor a mayor', () => {
    expect(alternarMateria([5], 2)).toEqual([2, 5])
  })

  it('destilda una que estaba', () => {
    expect(alternarMateria([2, 5], 2)).toEqual([5])
    expect(alternarMateria([2], 2)).toEqual([])
  })
})

describe('textoBotonMaterias', () => {
  it('sin ninguna, "Todas"', () => {
    expect(textoBotonMaterias([])).toBe('Todas')
  })

  it('una o dos, por nombre', () => {
    expect(textoBotonMaterias([{ nombre: 'Inglés' }])).toBe('Inglés')
    expect(textoBotonMaterias([{ nombre: 'Inglés' }, { nombre: 'Matemática' }])).toBe(
      'Inglés y Matemática',
    )
  })

  it('tres o más, la cantidad', () => {
    expect(textoBotonMaterias([{ nombre: 'A' }, { nombre: 'B' }, { nombre: null }])).toBe(
      '3 materias',
    )
  })

  it('"…" mientras falta el nombre de alguna', () => {
    expect(textoBotonMaterias([{ nombre: null }])).toBe('…')
  })
})
