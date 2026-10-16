import { describe, expect, it } from 'vitest'

import { leerPorcentaje, MENSAJE_PORCENTAJE, porcentajeFormSchema } from '../reparto.schema'

describe('leerPorcentaje', () => {
  it('entero o con hasta dos decimales, con coma o con punto', () => {
    expect(leerPorcentaje('18')).toEqual({ ok: true, valor: 18 })
    expect(leerPorcentaje('18,5')).toEqual({ ok: true, valor: 18.5 })
    expect(leerPorcentaje('18.5')).toEqual({ ok: true, valor: 18.5 })
    expect(leerPorcentaje('12,25')).toEqual({ ok: true, valor: 12.25 })
    expect(leerPorcentaje('0')).toEqual({ ok: true, valor: 0 })
    expect(leerPorcentaje('99,99')).toEqual({ ok: true, valor: 99.99 })
  })

  it('fuera de rango, con más de dos decimales o sin formato: el mensaje de la API', () => {
    for (const texto of ['100', '-1', '15,123', 'abc', '1.500']) {
      expect(leerPorcentaje(texto)).toEqual({ ok: false, mensaje: MENSAJE_PORCENTAJE })
    }
  })

  it('vacío: obligatorio', () => {
    expect(leerPorcentaje('')).toEqual({ ok: false, mensaje: 'Campo obligatorio' })
    expect(leerPorcentaje(' ')).toEqual({ ok: false, mensaje: 'Campo obligatorio' })
  })
})

describe('porcentajeFormSchema', () => {
  it('valida el campo con leerPorcentaje', () => {
    expect(porcentajeFormSchema.safeParse({ porcentaje: '18,5' }).success).toBe(true)
    const resultado = porcentajeFormSchema.safeParse({ porcentaje: '100' })
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.message).toBe(MENSAJE_PORCENTAJE)
  })
})
