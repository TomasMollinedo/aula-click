import type { ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { registrarFuentes } from './fuentes'

/**
 * Renderiza un documento (un `DocumentoOficialPdf` con su contenido) y devuelve los bytes del
 * PDF. Registra las fuentes antes del primer render.
 */
export function renderizarPdf(elemento: ReactElement): Promise<Buffer> {
  registrarFuentes()
  // `renderToBuffer` pide el elemento `<Document>`; acá llega el componente que lo envuelve.
  return renderToBuffer(elemento as ReactElement<DocumentProps>)
}
