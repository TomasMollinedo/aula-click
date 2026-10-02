import type { ReactElement } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import { fechaDocumento, formatearPesos, rangoHoras } from '@/server/shared/formato'
import { CampoPdf, CamposPdf, SeccionPdf } from '@/server/shared/pdf/campos'
import { DocumentoOficialPdf, type CentroPdf } from '@/server/shared/pdf/documento'
import {
  BORDE_FINO,
  COLORES,
  RADIO_TARJETA,
  SEPARACION_BLOQUES,
  TEXTO,
  espaciado,
  px,
} from '@/server/shared/pdf/estilos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import { CeldaPdf, CierrePdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import { textoNumero, textoRegistradoPor } from './pagos.formato'
import type { Comprobante } from './pagos.validation'

// El comprobante de pago en PDF (HU-15, T-111). Solo presentación: recibe el comprobante que
// devuelve el service y no suma ni recalcula nada (importes, total y vuelto son los de la API).

export type DatosComprobantePdf = {
  comprobante: Comprobante
  centro: CentroPdf
  logo: ReactElement
  /** Quien saca el PDF (el usuario de la sesión); quien registró el pago va en el pie. */
  emitidoPor: string
  fechaEmision: string
}

const TITULO = 'Comprobante de pago'

// Las proporciones de las columnas son las del comprobante que se imprimía desde el navegador.
const COLUMNAS: ColumnaPdf[] = [
  { titulo: 'Fecha', ancho: 92 },
  { titulo: 'Horario', ancho: 101.5 },
  { titulo: 'Materia', ancho: 100.2 },
  { titulo: 'Profesor', ancho: 116.9 },
  { titulo: 'Importe', ancho: 68, numerica: true },
]

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
  totales: {
    alignSelf: 'flex-end',
    width: px(288),
    paddingHorizontal: px(24),
    paddingVertical: px(20),
    borderWidth: BORDE_FINO,
    borderColor: COLORES.borde,
    borderRadius: RADIO_TARJETA,
    backgroundColor: COLORES.fondoSuave,
  },
  filaTotal: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: px(24),
  },
  etiquetaTotal: {
    ...TEXTO.etiquetaTabla,
    fontWeight: 700,
    color: COLORES.cobalto,
    letterSpacing: espaciado.muyAncho(TEXTO.etiquetaTabla.fontSize),
    textTransform: 'uppercase',
    // react-pdf no alinea por línea base: esto deja la etiqueta sobre la del importe.
    marginBottom: 2.4,
  },
  total: { ...TEXTO.titulo, fontWeight: 600 },
  recibido: {
    marginTop: px(12),
    paddingTop: px(12),
    borderTopWidth: BORDE_FINO,
    borderTopColor: COLORES.borde,
    gap: px(4),
  },
  filaRecibido: { flexDirection: 'row', justifyContent: 'space-between', gap: px(24) },
  etiquetaRecibido: { ...TEXTO.normal, color: COLORES.texto70 },
  importeRecibido: { ...TEXTO.normal },
  pie: { paddingTop: px(12), borderTopWidth: BORDE_FINO, borderTopColor: COLORES.bordeFuerte },
  registradoPor: { ...TEXTO.chico, color: COLORES.texto70 },
  leyenda: { ...TEXTO.chico, color: COLORES.texto50, marginTop: px(4) },
})

export function ComprobantePdf({
  comprobante,
  centro,
  logo,
  emitidoPor,
  fechaEmision,
}: DatosComprobantePdf) {
  const { alumno, turnos } = comprobante
  return (
    <DocumentoOficialPdf
      titulo={TITULO}
      referencia={textoNumero(comprobante.numeroComprobante)}
      emitidoPor={emitidoPor}
      fechaEmision={fechaEmision}
      centro={centro}
      logo={logo}
    >
      <View style={estilos.contenido}>
        <SeccionPdf>
          <CamposPdf>
            <CampoPdf label="Alumno" valor={`${alumno.nombre} ${alumno.apellido}`} />
            <CampoPdf label="DNI" valor={alumno.dni} />
            <CampoPdf label="Fecha de pago" valor={fechaDocumento(comprobante.fechaPago)} />
            <CampoPdf label="Forma de pago" valor={comprobante.formaPago.nombre} />
          </CamposPdf>
        </SeccionPdf>

        <TablaPdf columnas={COLUMNAS} cierre={<Cierre comprobante={comprobante} />}>
          {turnos.map((turno) => (
            <FilaPdf key={`${turno.turnoId}|${turno.fecha}`}>
              <CeldaPdf>{fechaDocumento(turno.fecha)}</CeldaPdf>
              <CeldaPdf>{rangoHoras(turno.horaInicio, turno.horaFin)}</CeldaPdf>
              <CeldaPdf>{turno.materia.nombre}</CeldaPdf>
              <CeldaPdf>
                {turno.profesor.nombre} {turno.profesor.apellido}
              </CeldaPdf>
              <CeldaPdf>{formatearPesos(turno.importe)}</CeldaPdf>
            </FilaPdf>
          ))}
        </TablaPdf>
      </View>
    </DocumentoOficialPdf>
  )
}

/** Totales, observaciones y pie: pasan de hoja enteros y con la última fila de la tabla. */
function Cierre({ comprobante }: { comprobante: Comprobante }) {
  return (
    <CierrePdf>
      <Totales comprobante={comprobante} />

      {comprobante.observaciones ? (
        <SeccionPdf>
          <CampoPdf label="Observaciones" valor={comprobante.observaciones} />
        </SeccionPdf>
      ) : null}

      <View style={estilos.pie}>
        <Text style={estilos.registradoPor}>
          {textoRegistradoPor(comprobante.registradoPor, comprobante.registradoEl)}
        </Text>
        <Text style={estilos.leyenda}>Comprobante interno de pago · No válido como factura</Text>
      </View>
    </CierrePdf>
  )
}

/**
 * El total, destacado, y lo que se recibió y se devolvió. Sin monto recibido (un pago anterior a
 * que fuera obligatorio) solo va el total.
 */
function Totales({ comprobante }: { comprobante: Comprobante }) {
  const { total, montoRecibido, vuelto } = comprobante
  return (
    <View style={estilos.totales}>
      <View style={estilos.filaTotal}>
        <Text style={estilos.etiquetaTotal}>Total</Text>
        <Text style={estilos.total}>{formatearPesos(total)}</Text>
      </View>
      {montoRecibido !== null || vuelto !== null ? (
        <View style={estilos.recibido}>
          {montoRecibido !== null ? (
            <View style={estilos.filaRecibido}>
              <Text style={estilos.etiquetaRecibido}>Monto recibido</Text>
              <Text style={estilos.importeRecibido}>{formatearPesos(montoRecibido)}</Text>
            </View>
          ) : null}
          {vuelto !== null ? (
            <View style={estilos.filaRecibido}>
              <Text style={estilos.etiquetaRecibido}>Vuelto</Text>
              <Text style={estilos.importeRecibido}>{formatearPesos(vuelto)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** Los bytes del PDF del comprobante. */
export function renderizarComprobantePdf(datos: DatosComprobantePdf): Promise<Buffer> {
  return renderizarPdf(<ComprobantePdf {...datos} />)
}
