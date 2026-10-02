import { describe, expect, it } from 'vitest'
import { nombreArchivoPdf, respuestaPdf } from '../pdf/respuesta'

describe('nombreArchivoPdf', () => {
  it.each([
    ['comprobante-32', 'comprobante-32'],
    ['Comprobante N° 1024', 'comprobante-n-1024'],
    ['Turnos de Ñandú Pérez', 'turnos-de-nandu-perez'],
    ['  Agenda   diaria — 05/10/2026  ', 'agenda-diaria-05-10-2026'],
    ['Güemes, Martín Miguel', 'guemes-martin-miguel'],
    ['a/b\\c"d.pdf', 'a-b-c-d-pdf'],
  ])('%o → %o', (texto, nombre) => {
    expect(nombreArchivoPdf(texto)).toBe(nombre)
  })

  it('sin nada utilizable usa un nombre genérico', () => {
    expect(nombreArchivoPdf('')).toBe('documento')
    expect(nombreArchivoPdf('°°°')).toBe('documento')
  })
})

describe('respuestaPdf', () => {
  const pdf = Buffer.from('%PDF-1.7 contenido')

  it('headers exactos: visor del navegador, nombre de archivo y sin caché', () => {
    expect(respuestaPdf(pdf, 'comprobante-32').headers).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="comprobante-32.pdf"; filename*=UTF-8''comprobante-32.pdf`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  it('sanea el nombre: sin tildes, ñ ni espacios', () => {
    expect(respuestaPdf(pdf, 'Turnos de Ñandú Pérez').headers['Content-Disposition']).toBe(
      `inline; filename="turnos-de-nandu-perez.pdf"; filename*=UTF-8''turnos-de-nandu-perez.pdf`,
    )
  })

  it('el cuerpo son los mismos bytes, en un ArrayBuffer propio', () => {
    // Un Buffer chico de Node es una vista sobre un pool compartido: no se manda el pool entero.
    const { cuerpo } = respuestaPdf(pdf, 'x')
    expect(cuerpo).toBeInstanceOf(ArrayBuffer)
    expect(cuerpo.byteLength).toBe(pdf.byteLength)
    expect(Buffer.from(cuerpo).equals(pdf)).toBe(true)
  })
})
