import { describe, expect, it } from 'vitest'
import {
  esImagen,
  formatearTamano,
  listarEtiquetas,
  rechazoArchivo,
  type TiposAceptados,
} from '../campo-archivo-reglas'

const MB = 1024 * 1024
const COMPROBANTE: TiposAceptados = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
}

describe('rechazoArchivo', () => {
  it('acepta un tipo de la lista dentro del tamaño (incluido exactamente el máximo)', () => {
    expect(rechazoArchivo({ type: 'application/pdf', size: 1 * MB }, COMPROBANTE, 5 * MB)).toBe(
      null,
    )
    expect(rechazoArchivo({ type: 'image/png', size: 5 * MB }, COMPROBANTE, 5 * MB)).toBe(null)
  })

  it('un PDF de 6 MB con máximo de 5 MB → tamano', () => {
    expect(rechazoArchivo({ type: 'application/pdf', size: 6 * MB }, COMPROBANTE, 5 * MB)).toBe(
      'tamano',
    )
  })

  it('un tipo fuera de la lista → tipo, aunque además sea grande', () => {
    expect(rechazoArchivo({ type: 'image/gif', size: 1 }, COMPROBANTE, 5 * MB)).toBe('tipo')
    expect(rechazoArchivo({ type: 'text/plain', size: 9 * MB }, COMPROBANTE, 5 * MB)).toBe('tipo')
  })

  it('un tipo vacío (el navegador no lo reconoce) → tipo', () => {
    expect(rechazoArchivo({ type: '', size: 1 }, COMPROBANTE, 5 * MB)).toBe('tipo')
  })

  it('no acepta claves heredadas del objeto como tipo', () => {
    expect(rechazoArchivo({ type: 'toString', size: 1 }, COMPROBANTE, 5 * MB)).toBe('tipo')
  })
})

describe('listarEtiquetas', () => {
  it('une con comas y "o" la última', () => {
    expect(listarEtiquetas(COMPROBANTE)).toBe('JPG, PNG o PDF')
    expect(listarEtiquetas({ 'image/jpeg': 'JPG', 'image/png': 'PNG' })).toBe('JPG o PNG')
  })

  it('una sola etiqueta queda sola, y las repetidas se muestran una vez', () => {
    expect(listarEtiquetas({ 'application/pdf': 'PDF' })).toBe('PDF')
    expect(listarEtiquetas({ 'image/jpeg': 'JPG', 'image/pjpeg': 'JPG', 'image/png': 'PNG' })).toBe(
      'JPG o PNG',
    )
  })
})

describe('formatearTamano', () => {
  it.each([
    [850, '850 B'],
    [1024, '1 KB'],
    [12 * 1024, '12 KB'],
    [1.5 * MB, '1,5 MB'],
    [5 * MB, '5 MB'],
    [6 * MB, '6 MB'],
    [1.25 * MB, '1,3 MB'],
    [2 * 1024 * MB, '2 GB'],
  ])('%i bytes → %s', (bytes, texto) => {
    expect(formatearTamano(bytes)).toBe(texto)
  })
})

describe('esImagen', () => {
  it('las imágenes van con miniatura; un PDF, con ícono', () => {
    expect(esImagen('image/png')).toBe(true)
    expect(esImagen('image/jpeg')).toBe(true)
    expect(esImagen('application/pdf')).toBe(false)
  })
})
