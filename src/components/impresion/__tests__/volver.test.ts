import { describe, expect, it } from 'vitest'

import { tieneHistorialPropio } from '../volver'

// "Volver" de las hojas de impresión: con historial propio vuelve atrás; sin él, cierra la pestaña
// o va a la ruta de respaldo.

describe('tieneHistorialPropio', () => {
  it('pestaña nueva (`target="_blank"`): una sola entrada, no hay adónde volver', () => {
    expect(tieneHistorialPropio({ longitud: 1 })).toBe(false)
    expect(tieneHistorialPropio({ longitud: 0 })).toBe(false)
  })

  it('se llegó navegando en la misma pestaña: hay adónde volver', () => {
    expect(tieneHistorialPropio({ longitud: 2 })).toBe(true)
    expect(tieneHistorialPropio({ longitud: 14 })).toBe(true)
  })

  it('con Navigation API manda la posición entre las entradas del sitio, no la longitud', () => {
    // URL pegada en una pestaña nueva de Chrome: la "Nueva pestaña" suma una entrada ajena.
    expect(tieneHistorialPropio({ longitud: 2, indice: 0 })).toBe(false)
    expect(tieneHistorialPropio({ longitud: 1, indice: 0 })).toBe(false)
    expect(tieneHistorialPropio({ longitud: 5, indice: 3 })).toBe(true)
  })
})
