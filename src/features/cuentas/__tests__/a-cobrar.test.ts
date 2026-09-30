import { describe, expect, it } from 'vitest'

import { aCobrar, claveOcurrencia } from '../a-cobrar'
import { ADEUDADOS, CUENTA } from './fixtures'

describe('aCobrar', () => {
  it('ocurrencia de la cuenta: solo saca el estado', () => {
    expect(aCobrar(CUENTA.adeudados[0])).toEqual({
      turnoId: 41,
      fecha: '2026-09-21',
      horaInicio: '09:00',
      horaFin: '10:00',
      materia: { id: 2, nombre: 'Matemática' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
      importe: 8000,
    })
  })

  it('adeudado de la vista global: saca el estado y el alumno, y conserva el importe con decimales', () => {
    const fila = ADEUDADOS.data[1]
    const resultado = aCobrar(fila)
    expect(resultado).toEqual({
      turnoId: 63,
      fecha: '2026-09-22',
      horaInicio: '18:00',
      horaFin: '19:00',
      materia: { id: 7, nombre: 'Física' },
      profesor: { id: 5, nombre: 'Juan', apellido: 'Ruiz' },
      importe: 9000.5,
    })
    expect(resultado).not.toHaveProperty('alumno')
    expect(resultado).not.toHaveProperty('estado')
  })

  it('un próximo sin precio: el importe null pasa tal cual', () => {
    expect(aCobrar({ ...CUENTA.proximos[1], importe: null }).importe).toBeNull()
  })

  it('devuelve un objeto nuevo (la copia de la selección)', () => {
    const fila = CUENTA.proximos[0]
    expect(aCobrar(fila)).not.toBe(fila)
  })
})

describe('claveOcurrencia', () => {
  it('turnoId y fecha', () => {
    expect(claveOcurrencia({ turnoId: 41, fecha: '2026-09-21' })).toBe('41|2026-09-21')
  })

  it('el mismo turno en otra fecha es otra ocurrencia', () => {
    expect(claveOcurrencia(CUENTA.adeudados[0])).not.toBe(claveOcurrencia(CUENTA.adeudados[1]))
  })
})
