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
import {
  datosDelMedio,
  textoAnuladoEl,
  textoMotivoAnulacion,
  textoNumero,
  textoRegistradoPor,
} from './pagos.formato'
import { agruparPorMateria } from './pagos.reglas'
import type { Comprobante } from './pagos.validation'

// El comprobante de pago en PDF (HU-15, T-111; formas de pago, HU-23, T-96). Solo presentación:
// recibe el comprobante que devuelve el service y no suma ni recalcula nada (importes, total y
// vuelto son los de la API). Los textos salen de `pagos.formato.ts`. Un pago anulado (HU-42) lleva
// arriba de todo "ANULADO", con el motivo y la fecha de anulación.

type Turno = Comprobante['turnos'][number]

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

/** `--color-cancelado` de la pantalla (el de `destructive`): lo anulado se lee como cancelado. */
const COLOR_ANULADO = '#6f1f2a'
/** El mismo color al 6 % sobre blanco: el fondo de la franja de anulado. */
const FONDO_ANULADO = '#f6eff0'

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
  anulado: {
    paddingHorizontal: px(24),
    paddingVertical: px(16),
    borderWidth: 1.5,
    borderColor: COLOR_ANULADO,
    borderRadius: RADIO_TARJETA,
    backgroundColor: FONDO_ANULADO,
    gap: px(4),
  },
  anuladoTitulo: {
    ...TEXTO.titulo,
    fontWeight: 700,
    color: COLOR_ANULADO,
    letterSpacing: espaciado.muyAncho(TEXTO.titulo.fontSize),
  },
  anuladoDetalle: { ...TEXTO.normal, color: COLORES.texto80 },
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
  subtotal: { fontWeight: 700 },
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
  const medio = datosDelMedio(comprobante)
  // Con más de una materia, la tabla va agrupada por materia con el subtotal de cada una (HU-25).
  const grupos = agruparPorMateria(turnos)
  const filaDe = (turno: Turno) => (
    <FilaPdf key={`${turno.turnoId}|${turno.fecha}`}>
      <CeldaPdf>{fechaDocumento(turno.fecha)}</CeldaPdf>
      <CeldaPdf>{rangoHoras(turno.horaInicio, turno.horaFin)}</CeldaPdf>
      <CeldaPdf>{turno.materia.nombre}</CeldaPdf>
      <CeldaPdf>
        {turno.profesor.nombre} {turno.profesor.apellido}
      </CeldaPdf>
      <CeldaPdf>{formatearPesos(turno.importe)}</CeldaPdf>
    </FilaPdf>
  )
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
        {comprobante.anulacion ? (
          <View style={estilos.anulado}>
            <Text style={estilos.anuladoTitulo}>ANULADO</Text>
            <Text style={estilos.anuladoDetalle}>
              Motivo: {textoMotivoAnulacion(comprobante.anulacion)}
            </Text>
            <Text style={estilos.anuladoDetalle}>{textoAnuladoEl(comprobante.anulacion)}</Text>
          </View>
        ) : null}

        <SeccionPdf>
          <CamposPdf>
            <CampoPdf label="Alumno" valor={`${alumno.nombre} ${alumno.apellido}`} />
            <CampoPdf label="DNI" valor={alumno.dni} />
            <CampoPdf label="Fecha de pago" valor={fechaDocumento(comprobante.fechaPago)} />
            <CampoPdf label="Forma de pago" valor={comprobante.formaPago.nombre} />
          </CamposPdf>
        </SeccionPdf>

        {/* Los datos de la transferencia o del débito; el efectivo los muestra con el total. */}
        {medio.length > 0 ? (
          <SeccionPdf>
            <CamposPdf>
              {medio.map(({ label, valor }) => (
                <CampoPdf key={label} label={label} valor={valor} />
              ))}
            </CamposPdf>
          </SeccionPdf>
        ) : null}

        <TablaPdf columnas={COLUMNAS} cierre={<Cierre comprobante={comprobante} />}>
          {grupos.length > 1
            ? grupos.flatMap((grupo) => [
                ...grupo.turnos.map(filaDe),
                <FilaPdf key={`subtotal-${grupo.materia.id}`}>
                  <CeldaPdf>{''}</CeldaPdf>
                  <CeldaPdf>{''}</CeldaPdf>
                  <CeldaPdf>{''}</CeldaPdf>
                  {/* En la columna más ancha, pegado al importe: el nombre no se parte. */}
                  <CeldaPdf>
                    <Text style={estilos.subtotal}>Subtotal {grupo.materia.nombre}</Text>
                  </CeldaPdf>
                  <CeldaPdf>
                    <Text style={estilos.subtotal}>{formatearPesos(grupo.subtotal)}</Text>
                  </CeldaPdf>
                </FilaPdf>,
              ])
            : turnos.map(filaDe)}
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
