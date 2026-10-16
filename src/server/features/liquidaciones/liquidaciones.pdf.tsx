import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { fechaDocumento, formatearPesos, rangoHoras } from '@/server/shared/formato'
import { CampoPdf, CamposPdf, MensajePdf, SeccionPdf } from '@/server/shared/pdf/campos'
import { DocumentoOficialPdf } from '@/server/shared/pdf/documento'
import { COLORES, SEPARACION_BLOQUES, TEXTO, espaciado, px } from '@/server/shared/pdf/estilos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import { CeldaPdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import type { LiquidacionDocumento } from './liquidaciones.documentos'
import {
  nombreDelProfesor,
  textoEstadoLiquidacion,
  textoMesDelDocumento,
  textoNumeroComprobante,
  textoPorcentaje,
} from './liquidaciones.formato'

// La liquidación de un profesor en un mes, en PDF (HU-44 y HU-45, T-125). Solo presentación: lo
// que arma el service con **el mismo cálculo** del detalle (`liquidaciones.condiciones.ts`), en su
// orden: profesor, mes, estado y, si está pagada, la transferencia; turnos; ajustes; totales. Sin
// la forma de pago de las familias ni el comprobante adjunto. La columna del comprobante sólo va
// en el documento del gerente (decisión T-171).
//
// Sin contexto ni hooks de React (arquitectura-backend.md → Documentos PDF): las `FilaPdf` son
// hijas directas de `TablaPdf`.

export type DatosLiquidacionPdf = EncabezadoDeDocumento & { documento: LiquidacionDocumento }

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
  tituloSeccion: {
    ...TEXTO.etiqueta,
    fontWeight: 700,
    color: COLORES.texto60,
    letterSpacing: espaciado.muyAncho(TEXTO.etiqueta.fontSize),
    textTransform: 'uppercase',
    marginBottom: px(8),
  },
  filaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: px(4) },
  etiquetaTotal: { ...TEXTO.normal, fontWeight: 700, color: COLORES.marino },
  total: { ...TEXTO.normal, fontWeight: 700, color: COLORES.marino },
})

// La fecha y el horario van en una columna, en dos renglones: con el comprobante son muchas columnas
// para el ancho de la hoja A4.
const COLUMNAS_TURNOS_GERENTE: ColumnaPdf[] = [
  { titulo: 'Fecha y horario', ancho: 96 },
  { titulo: 'Alumno', ancho: 100 },
  { titulo: 'Materia', ancho: 96 },
  { titulo: 'Comprobante', ancho: 84 },
  { titulo: 'Importe', ancho: 76, numerica: true },
  { titulo: '% del centro', ancho: 60, numerica: true },
  { titulo: 'Parte del profesor', ancho: 80, numerica: true },
]

// El del profesor, sin el comprobante: su ancho pasa al alumno y la materia.
const COLUMNAS_TURNOS_PROFESOR: ColumnaPdf[] = [
  { titulo: 'Fecha y horario', ancho: 96 },
  { titulo: 'Alumno', ancho: 140 },
  { titulo: 'Materia', ancho: 140 },
  { titulo: 'Importe', ancho: 76, numerica: true },
  { titulo: '% del centro', ancho: 60, numerica: true },
  { titulo: 'Parte del profesor', ancho: 80, numerica: true },
]

const COLUMNAS_AJUSTES: ColumnaPdf[] = [
  { titulo: 'Concepto', ancho: 400 },
  { titulo: 'Importe', ancho: 100, numerica: true },
]

/** Un listado con su título, que no se separa de su primera fila. */
function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View>
      {/* El título no queda solo al final de una hoja. */}
      <View wrap={false}>
        <Text style={estilos.tituloSeccion}>{titulo}</Text>
      </View>
      {children}
    </View>
  )
}

export function LiquidacionPdf({ documento, ...encabezado }: DatosLiquidacionPdf) {
  const { profesor, mes, turnos, ajustes, transferencia, conComprobante } = documento

  return (
    <DocumentoOficialPdf
      titulo="Liquidación"
      referencia={textoMesDelDocumento(mes)}
      {...encabezado}
    >
      <View style={estilos.contenido}>
        <SeccionPdf>
          <CamposPdf>
            <CampoPdf label="Profesor" valor={nombreDelProfesor(profesor)} />
            <CampoPdf label="Mes" valor={textoMesDelDocumento(mes)} />
            <CampoPdf label="Estado" valor={textoEstadoLiquidacion(documento)} />
            {/* La transferencia, junto a los datos de arriba: así no queda sola en otra hoja. */}
            {transferencia ? (
              <CampoPdf
                label="Fecha de la transferencia"
                valor={fechaDocumento(transferencia.fecha)}
              />
            ) : null}
            {transferencia ? (
              <CampoPdf label="Número de operación" valor={transferencia.numeroOperacion} />
            ) : null}
          </CamposPdf>
        </SeccionPdf>

        <Seccion titulo="Turnos">
          {turnos.length === 0 ? (
            <MensajePdf>Sin turnos en el mes.</MensajePdf>
          ) : (
            <TablaPdf
              columnas={conComprobante ? COLUMNAS_TURNOS_GERENTE : COLUMNAS_TURNOS_PROFESOR}
              alternada
            >
              {turnos.map((turno, indice) => (
                // Un turno no trae id propio: el orden es el del motor y no cambia.
                <FilaPdf key={indice}>
                  <CeldaPdf>
                    {`${fechaDocumento(turno.fecha)}\n${rangoHoras(turno.horaInicio, turno.horaFin)}`}
                  </CeldaPdf>
                  <CeldaPdf>{nombreDelProfesor(turno.alumno)}</CeldaPdf>
                  <CeldaPdf>{turno.materia}</CeldaPdf>
                  {conComprobante && turno.numeroComprobante !== null ? (
                    <CeldaPdf>{textoNumeroComprobante(turno.numeroComprobante)}</CeldaPdf>
                  ) : null}
                  <CeldaPdf>{formatearPesos(turno.importe)}</CeldaPdf>
                  <CeldaPdf>{textoPorcentaje(turno.porcentaje)}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(turno.parteProfesor)}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          )}
        </Seccion>

        {ajustes.length > 0 && (
          <Seccion titulo="Ajustes">
            <TablaPdf columnas={COLUMNAS_AJUSTES} alternada>
              {ajustes.map((ajuste, indice) => (
                <FilaPdf key={indice}>
                  <CeldaPdf>{ajuste.texto}</CeldaPdf>
                  <CeldaPdf>{formatearPesos(ajuste.importe)}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          </Seccion>
        )}

        <Seccion titulo="Totales">
          <SeccionPdf>
            <CamposPdf>
              <CampoPdf label="Total cobrado" valor={formatearPesos(documento.totalCobrado)} />
              <CampoPdf label="Parte del centro" valor={formatearPesos(documento.parteCentro)} />
              <CampoPdf
                label="Parte del profesor"
                valor={formatearPesos(documento.parteProfesor)}
              />
              <CampoPdf label="Ajustes" valor={formatearPesos(documento.totalAjustes)} />
            </CamposPdf>
            <View style={estilos.filaTotal}>
              <Text style={estilos.etiquetaTotal}>Total a pagar</Text>
              <Text style={estilos.total}>{formatearPesos(documento.total)}</Text>
            </View>
          </SeccionPdf>
        </Seccion>
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF de la liquidación de un profesor en un mes. */
export function renderizarLiquidacionPdf(datos: DatosLiquidacionPdf): Promise<Buffer> {
  return renderizarPdf(<LiquidacionPdf {...datos} />)
}
