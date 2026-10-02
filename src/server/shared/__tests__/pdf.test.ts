import { createElement, type ReactElement, type ReactNode } from 'react'
import { Text, View } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { CampoPdf, CamposPdf, SeccionPdf } from '../pdf/campos'
import { DocumentoOficialPdf, type DocumentoOficialPdfProps } from '../pdf/documento'
import { renderizarPdf } from '../pdf/renderizar'
import { CeldaPdf, CierrePdf, FilaPdf, TablaPdf, type ColumnaPdf } from '../pdf/tabla'
import { contarPaginas, idioma, metadato } from './pdf-inspeccion'

// Las primitivas del documento oficial, con un render real (lee las fuentes del repo). Sin JSX:
// vitest sólo incluye `*.test.ts`.

const centro = { nombre: 'Nexo Académico', direccion: 'Los Tarcos 300', telefono: '3875631032' }
const logo = createElement(View, { style: { width: 52, height: 42 } })

function documento(props: Partial<DocumentoOficialPdfProps>, ...children: ReactElement[]) {
  return createElement(
    DocumentoOficialPdf,
    {
      titulo: 'Detalle del turno',
      emitidoPor: 'Laura Gómez',
      fechaEmision: '05/10/2026 11:30',
      centro,
      logo,
      ...props,
    } as DocumentoOficialPdfProps,
    ...children,
  )
}

const columnas: ColumnaPdf[] = [
  { titulo: 'Fecha', ancho: 1 },
  { titulo: 'Detalle', ancho: 3 },
  { titulo: 'Importe', ancho: 1, numerica: true },
]

function fila(i: number) {
  return createElement(
    FilaPdf,
    // Los hijos van como argumentos: el tipo de las props los pide, de ahí el `as`.
    { key: i } as { key: number; children: ReactNode },
    createElement(CeldaPdf, null, '05/10/2026'),
    createElement(CeldaPdf, null, `Fila ${i}`),
    createElement(CeldaPdf, null, '$ 8.000,00'),
  )
}

function tabla(cantidad: number, alternada = false) {
  return createElement(
    TablaPdf,
    {
      columnas,
      alternada,
      cierre: createElement(CierrePdf, null, createElement(Text, null, 'Total')),
    },
    ...Array.from({ length: cantidad }, (_, i) => fila(i)),
  )
}

describe('renderizarPdf', { timeout: 30_000 }, () => {
  it('devuelve un PDF de una hoja con los metadatos del documento', async () => {
    const seccion = createElement(
      SeccionPdf,
      null,
      createElement(
        CamposPdf,
        null,
        createElement(CampoPdf, { label: 'Alumno', valor: 'Lucía Álvarez' }),
        createElement(CampoPdf, { label: 'Email', valor: null }),
        createElement(CampoPdf, { label: 'Observaciones', valor: 'Una línea\nOtra línea' }),
      ),
    )
    const pdf = await renderizarPdf(documento({ referencia: 'N° 7' }, seccion, tabla(3)))

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(contarPaginas(pdf)).toBe(1)
    expect(metadato(pdf, 'Title')).toBe('Detalle del turno N° 7')
    expect(metadato(pdf, 'Author')).toBe('Nexo Académico')
    expect(metadato(pdf, 'Creator')).toBe('Nexo Académico')
    expect(metadato(pdf, 'Producer')).toBe('Nexo Académico')
    expect(idioma(pdf)).toBe('es')
  })

  it('sin referencia, el título del PDF es el del documento', async () => {
    const pdf = await renderizarPdf(documento({}, tabla(1)))
    expect(metadato(pdf, 'Title')).toBe('Detalle del turno')
  })

  it('una tabla larga, alternada, ocupa varias hojas; una tabla sin filas no falla', async () => {
    expect(contarPaginas(await renderizarPdf(documento({}, tabla(120, true))))).toBeGreaterThan(1)
    expect(contarPaginas(await renderizarPdf(documento({}, tabla(0))))).toBe(1)
  })
})
