import type { ReactElement, ReactNode } from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { BORDE_GRUESO, COLORES, PAGINA, TEXTO, espaciado, px } from './estilos'
import { FUENTE } from './fuentes'

// El documento oficial en PDF: la hoja A4 y el encabezado común (logo y datos del centro, quién
// lo emite y cuándo) más el título. Solo presentación: todo le llega por props, no lee la base ni
// la sesión. El contenido propio de cada documento va en `children`, armado con `SeccionPdf`,
// `CamposPdf`, `CampoPdf` y `TablaPdf`.

const estilos = StyleSheet.create({
  pagina: {
    paddingHorizontal: PAGINA.margenHorizontal,
    paddingTop: PAGINA.margenSuperior,
    paddingBottom: PAGINA.margenInferior,
    fontFamily: FUENTE,
    fontWeight: 400,
    color: COLORES.negro,
    ...TEXTO.normal,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: px(24),
    paddingBottom: px(20),
    marginBottom: px(32),
    borderBottomWidth: BORDE_GRUESO,
    borderBottomColor: COLORES.cobalto,
  },
  centro: { flexDirection: 'row', alignItems: 'center', gap: px(16) },
  nombreCentro: {
    ...TEXTO.centro,
    fontWeight: 700,
    color: COLORES.marino,
    letterSpacing: espaciado.apretado(TEXTO.centro.fontSize),
  },
  direccion: { ...TEXTO.chico, color: COLORES.texto60, marginTop: px(4) },
  telefono: { ...TEXTO.chico, color: COLORES.texto60 },
  emision: { flexShrink: 0, alignItems: 'flex-end', gap: px(8) },
  datoEmision: { alignItems: 'flex-end' },
  etiqueta: {
    ...TEXTO.etiquetaEncabezado,
    fontWeight: 700,
    color: COLORES.cobalto,
    letterSpacing: espaciado.muyAncho(TEXTO.etiquetaEncabezado.fontSize),
    textTransform: 'uppercase',
  },
  valorEmision: { ...TEXTO.chico, color: COLORES.texto80, marginTop: px(2) },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: px(24),
    marginBottom: px(24),
  },
  titulo: {
    ...TEXTO.titulo,
    fontWeight: 600,
    color: COLORES.marino,
    letterSpacing: espaciado.apretado(TEXTO.titulo.fontSize),
  },
})

export type CentroPdf = { nombre: string; direccion: string; telefono: string }

export type DocumentoOficialPdfProps = {
  titulo: string
  /** Lo que identifica al documento, a la derecha del título (el número del comprobante). */
  referencia?: string
  /** Quien saca el documento: el usuario de la sesión. */
  emitidoPor: string
  /** Ya con formato (`fechaHoraDocumento(ahora())`): `dd/MM/yyyy HH:mm`, hora del negocio. */
  fechaEmision: string
  centro: CentroPdf
  /** El logo del centro, ya con su tamaño (`ALTO_LOGO`): lo publica la feature `centro`. */
  logo: ReactElement
  children: ReactNode
}

/**
 * Documento oficial de una o más hojas A4. Los metadatos del PDF salen de acá: `title` es el
 * título con su referencia y el autor es el centro (el nombre del sistema no aparece).
 */
export function DocumentoOficialPdf({
  titulo,
  referencia,
  emitidoPor,
  fechaEmision,
  centro,
  logo,
  children,
}: DocumentoOficialPdfProps) {
  return (
    <Document
      title={referencia ? `${titulo} ${referencia}` : titulo}
      author={centro.nombre}
      creator={centro.nombre}
      producer={centro.nombre}
      language="es"
    >
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <View style={estilos.centro}>
            {logo}
            <View>
              <Text style={estilos.nombreCentro}>{centro.nombre}</Text>
              <Text style={estilos.direccion}>{centro.direccion}</Text>
              <Text style={estilos.telefono}>Tel. {centro.telefono}</Text>
            </View>
          </View>
          <View style={estilos.emision}>
            <View style={estilos.datoEmision}>
              <Text style={estilos.etiqueta}>Emitido por</Text>
              <Text style={estilos.valorEmision}>{emitidoPor}</Text>
            </View>
            <View style={estilos.datoEmision}>
              <Text style={estilos.etiqueta}>Fecha de emisión</Text>
              <Text style={estilos.valorEmision}>{fechaEmision}</Text>
            </View>
          </View>
        </View>

        <View style={estilos.filaTitulo}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {referencia ? <Text style={estilos.titulo}>{referencia}</Text> : null}
        </View>

        {children}
      </Page>
    </Document>
  )
}
