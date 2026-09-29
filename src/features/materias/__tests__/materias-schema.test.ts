import { describe, expect, it } from 'vitest'

import {
  detalleAValoresForm,
  leerPrecio,
  MENSAJE_PRECIO_FORMATO,
  materiaFormSchema,
  valoresFormACrear,
} from '../materias.schema'
import type { MateriaDetalle } from '../materias.types'

function erroresDelPrecio(precioHora: string) {
  const resultado = materiaFormSchema.safeParse({ nombre: 'Matemática', precioHora })
  if (resultado.success) return []
  return resultado.error.issues.filter((i) => i.path[0] === 'precioHora').map((i) => i.message)
}

describe('leerPrecio', () => {
  it('entero, con coma o con punto decimal', () => {
    expect(leerPrecio('7500')).toEqual({ ok: true, valor: 7500 })
    expect(leerPrecio('7500,5')).toEqual({ ok: true, valor: 7500.5 })
    expect(leerPrecio('7500,50')).toEqual({ ok: true, valor: 7500.5 })
    expect(leerPrecio('7500.25')).toEqual({ ok: true, valor: 7500.25 })
    expect(leerPrecio('  8000  ')).toEqual({ ok: true, valor: 8000 })
    expect(leerPrecio('0,01')).toEqual({ ok: true, valor: 0.01 })
  })

  it('vacío: obligatorio', () => {
    expect(leerPrecio('')).toEqual({ ok: false, mensaje: 'Campo obligatorio' })
    expect(leerPrecio('   ')).toEqual({ ok: false, mensaje: 'Campo obligatorio' })
  })

  it('0 no es un precio válido', () => {
    expect(leerPrecio('0')).toEqual({ ok: false, mensaje: 'Tiene que ser mayor a 0' })
    expect(leerPrecio('0,00')).toEqual({ ok: false, mensaje: 'Tiene que ser mayor a 0' })
  })

  it('tres decimales con coma: hasta dos decimales', () => {
    expect(leerPrecio('100,005')).toEqual({ ok: false, mensaje: 'Puede tener hasta dos decimales' })
    expect(leerPrecio('100,0055')).toEqual({
      ok: false,
      mensaje: 'Puede tener hasta dos decimales',
    })
  })

  it('"7.500" (punto de miles) se rechaza con el ejemplo, no se lee como 7,5', () => {
    expect(leerPrecio('7.500')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
    expect(leerPrecio('7.500,50')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
    expect(leerPrecio('1.000.000')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
  })

  it('ni negativos, ni letras, ni el signo $', () => {
    expect(leerPrecio('-100')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
    expect(leerPrecio('abc')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
    expect(leerPrecio('$ 7500')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
    expect(leerPrecio('7500,')).toEqual({ ok: false, mensaje: MENSAJE_PRECIO_FORMATO })
  })

  it('tope: hasta 99.999.999,99', () => {
    expect(leerPrecio('99999999,99')).toEqual({ ok: true, valor: 99999999.99 })
    const pasado = leerPrecio('100000000')
    expect(pasado.ok).toBe(false)
    expect(!pasado.ok && pasado.mensaje).toMatch(/^No puede superar \$\s99\.999\.999,99$/)
  })
})

describe('materiaFormSchema: precioHora', () => {
  it('marca el campo con el mensaje de leerPrecio', () => {
    expect(erroresDelPrecio('7500,50')).toEqual([])
    expect(erroresDelPrecio('')).toEqual(['Campo obligatorio'])
    expect(erroresDelPrecio('0')).toEqual(['Tiene que ser mayor a 0'])
    expect(erroresDelPrecio('7.500')).toEqual([MENSAJE_PRECIO_FORMATO])
  })
})

describe('valoresFormACrear', () => {
  it('el precio va como número y la descripción vacía como null', () => {
    expect(
      valoresFormACrear({ nombre: ' Física ', precioHora: '8000,5', descripcion: '  ' }),
    ).toEqual({ nombre: 'Física', precioHora: 8000.5, descripcion: null })
  })
})

describe('detalleAValoresForm', () => {
  const base: MateriaDetalle = {
    id: 1,
    nombre: 'Química',
    descripcion: null,
    estado: 'ACTIVO',
    precioHora: 7500.5,
    sinPrecio: false,
    profesores: [],
    createdAt: '2026-09-01T12:00:00.000Z',
    createdBy: null,
    updatedAt: '2026-09-01T12:00:00.000Z',
    updatedBy: null,
  }

  it('precio con coma decimal y dos decimales, que el formulario vuelve a leer igual', () => {
    const valores = detalleAValoresForm(base)
    expect(valores).toEqual({ nombre: 'Química', precioHora: '7500,50', descripcion: '' })
    expect(leerPrecio(valores.precioHora)).toEqual({ ok: true, valor: 7500.5 })
  })

  it('sin precio: el campo queda vacío para cargarlo', () => {
    expect(detalleAValoresForm({ ...base, precioHora: null, sinPrecio: true }).precioHora).toBe('')
  })
})
