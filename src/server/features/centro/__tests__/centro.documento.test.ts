import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DATOS_CENTRO, encabezadoDeDocumento } from '../centro.condiciones'

// El encabezado común de los documentos PDF: lo arman igual todos los controllers.

const relojFijo = () => new Date('2026-10-05T14:30:00.000Z')

describe('encabezadoDeDocumento', () => {
  it('los datos y el logo del centro, quién emite y la fecha de emisión en la hora del negocio', () => {
    const encabezado = encabezadoDeDocumento({ name: 'Laura', apellido: 'Gómez' }, relojFijo)

    expect(encabezado.centro).toEqual(DATOS_CENTRO)
    expect(isValidElement(encabezado.logo)).toBe(true)
    expect(encabezado.emitidoPor).toBe('Laura Gómez')
    expect(encabezado.fechaEmision).toBe('05/10/2026 11:30')
  })

  it('a las 23:30 hora Salta, la fecha de emisión es del día de Salta, no del de UTC', () => {
    const reloj = () => new Date('2026-09-23T02:30:00Z')
    expect(encabezadoDeDocumento({ name: 'Laura', apellido: 'Gómez' }, reloj).fechaEmision).toBe(
      '22/09/2026 23:30',
    )
  })

  it('"Emitido por" sin una de las partes no deja espacios de más', () => {
    expect(encabezadoDeDocumento({ name: 'Laura', apellido: '' }, relojFijo).emitidoPor).toBe(
      'Laura',
    )
    expect(encabezadoDeDocumento({}, relojFijo).emitidoPor).toBe('')
  })
})
