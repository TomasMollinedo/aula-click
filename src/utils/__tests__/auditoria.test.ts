import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { formatoInstante, nombreUsuarioAuditoria } from '../auditoria'

describe('formatoInstante', () => {
  it('muestra el instante UTC en la hora local, con fecha y hora', () => {
    const instante = '2026-09-22T13:45:00.000Z'
    // Lo esperado se arma con la zona del entorno de test: no depende de dónde corra.
    expect(formatoInstante(instante)).toBe(format(new Date(instante), 'dd/MM/yyyy, HH:mm'))
    expect(formatoInstante(instante)).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/)
  })
})

describe('nombreUsuarioAuditoria', () => {
  it('nombre y apellido del usuario', () => {
    expect(nombreUsuarioAuditoria({ id: 'u1', nombre: 'Laura', apellido: 'Gómez' })).toBe(
      'Laura Gómez',
    )
  })

  it('Sistema si lo cargó el seed', () => {
    expect(nombreUsuarioAuditoria(null)).toBe('Sistema')
  })
})
