import { describe, expect, it } from 'vitest'

import type { OpcionesDeCuenta } from '../cuentas.types'
import { etiquetaProfesor, materiasDelFiltro, profesoresDelFiltro } from '../opciones-de-cuenta'

const TODAS = [
  { id: 2, nombre: 'Matemática', inactiva: false },
  { id: 5, nombre: 'Inglés', inactiva: false },
  { id: 9, nombre: 'Química', inactiva: true },
]

const OPCIONES: OpcionesDeCuenta = {
  materias: [
    { id: 7, nombre: 'Física', estado: 'ACTIVO' },
    { id: 2, nombre: 'Matemática', estado: 'INACTIVO' },
  ],
  profesores: [
    { id: 8, nombre: 'Eva', apellido: 'Álvarez' },
    { id: 3, nombre: 'Ana', apellido: 'Gómez' },
    { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
  ],
}

describe('materiasDelFiltro', () => {
  it('sin alumno: todas las materias, aunque haya opciones', () => {
    expect(materiasDelFiltro(null, OPCIONES, TODAS)).toBe(TODAS)
  })

  it('con alumno: solo las de sus opciones, en su orden, con la baja como `inactiva`', () => {
    expect(materiasDelFiltro(12, OPCIONES, TODAS)).toEqual([
      { id: 7, nombre: 'Física', inactiva: false },
      { id: 2, nombre: 'Matemática', inactiva: true },
    ])
  })

  it('con alumno y sin opciones todavía: ninguna (nunca todas)', () => {
    expect(materiasDelFiltro(12, undefined, TODAS)).toEqual([])
  })
})

describe('profesoresDelFiltro', () => {
  it('sin texto: todos, como "Apellido, Nombre", en el orden de la API', () => {
    expect(profesoresDelFiltro(OPCIONES, '')).toEqual([
      { id: 8, etiqueta: 'Álvarez, Eva' },
      { id: 3, etiqueta: 'Gómez, Ana' },
      { id: 5, etiqueta: 'Ruiz, Juan' },
    ])
  })

  it('filtra en el cliente por todas las palabras, sin tildes ni orden', () => {
    expect(profesoresDelFiltro(OPCIONES, 'alvarez')).toEqual([{ id: 8, etiqueta: 'Álvarez, Eva' }])
    expect(profesoresDelFiltro(OPCIONES, 'juan ruiz')).toEqual([{ id: 5, etiqueta: 'Ruiz, Juan' }])
    expect(profesoresDelFiltro(OPCIONES, 'pérez')).toEqual([])
  })

  it('sin opciones todavía: ninguno', () => {
    expect(profesoresDelFiltro(undefined, '')).toEqual([])
  })
})

describe('etiquetaProfesor', () => {
  it('"Apellido, Nombre"', () => {
    expect(etiquetaProfesor({ nombre: 'Ana', apellido: 'Gómez' })).toBe('Gómez, Ana')
  })
})
