import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { fechaConDia, fechaDocumento, rangoHoras } from '@/server/shared/formato'
import { CampoPdf, CamposPdf, MensajePdf, SeccionPdf } from '@/server/shared/pdf/campos'
import { DocumentoOficialPdf } from '@/server/shared/pdf/documento'
import { COLORES, SEPARACION_BLOQUES, TEXTO, espaciado, px } from '@/server/shared/pdf/estilos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import { CeldaPdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import type { HistorialDocumento } from './historiales.documentos'
import {
  etiquetaNivelEscolaridad,
  fechaDelBloque,
  horarioDelBloque,
  nombreProfesor,
  textoEstadoDeLaHora,
  textoFiltrosDelHistorial,
  textoMesDelHistorial,
  textoMotivoDeCancelado,
  textoNotaDelExamen,
  textoResumen,
  textosDelBloque,
  tituloGrupo,
} from './historiales.formato'

// El historial académico de un alumno en un período, en PDF (HU-32, T-110). Solo presentación:
// lo que arma el service con **el mismo cálculo** del historial de la pantalla (los grupos, su
// resumen y sus bloques de horas seguidas) y no agrupa, no reordena y no cuenta nada. No lleva las
// observaciones internas del alumno ni de los turnos.
//
// Sin contexto ni hooks de React (arquitectura-backend.md → Documentos PDF): las `FilaPdf` son
// hijas directas de `TablaPdf`.

export type DatosHistorialPdf = EncabezadoDeDocumento & { documento: HistorialDocumento }

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
  grupo: { gap: px(8) },
  tituloGrupo: { ...TEXTO.normal, fontWeight: 600, color: COLORES.marino },
  resumenGrupo: { ...TEXTO.chico, color: COLORES.texto60 },
  tituloSeccion: {
    ...TEXTO.etiqueta,
    fontWeight: 700,
    color: COLORES.texto60,
    letterSpacing: espaciado.muyAncho(TEXTO.etiqueta.fontSize),
    textTransform: 'uppercase',
    marginBottom: px(8),
  },
})

// Las proporciones de las columnas: las clases necesitan lugar para los textos de la asistencia.
const COLUMNAS_CLASES: ColumnaPdf[] = [
  { titulo: 'Fecha', ancho: 72 },
  { titulo: 'Horario', ancho: 92 },
  { titulo: 'Clases', ancho: 136 },
  { titulo: 'Qué se trabajó e indicaciones', ancho: 200 },
]

const COLUMNAS_CANCELADOS: ColumnaPdf[] = [
  { titulo: 'Fecha', ancho: 72 },
  { titulo: 'Horario', ancho: 80 },
  { titulo: 'Materia', ancho: 96 },
  { titulo: 'Profesor', ancho: 96 },
  { titulo: 'Motivo', ancho: 156 },
]

const COLUMNAS_EXAMENES: ColumnaPdf[] = [
  { titulo: 'Fecha', ancho: 88 },
  { titulo: 'Materia', ancho: 280 },
  { titulo: 'Nota', ancho: 72 },
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

/** Un grupo del historial: la materia con su profesor, su resumen y sus bloques de horas seguidas. */
function GrupoDelHistorialPdf({ grupo }: { grupo: HistorialDocumento['grupos'][number] }) {
  return (
    <View style={estilos.grupo}>
      <View wrap={false}>
        <Text style={estilos.tituloGrupo}>{tituloGrupo(grupo)}</Text>
        <Text style={estilos.resumenGrupo}>{textoResumen(grupo.resumen)}</Text>
      </View>
      <TablaPdf columnas={COLUMNAS_CLASES} alternada>
        {grupo.bloques.map((bloque) => {
          const textos = textosDelBloque(bloque)
          return (
            <FilaPdf key={`${bloque.fecha}-${bloque.horaInicio}`}>
              <CeldaPdf>{fechaDelBloque(bloque)}</CeldaPdf>
              <CeldaPdf>{horarioDelBloque(bloque)}</CeldaPdf>
              {/* El estado de **cada** hora del bloque, uno por renglón. */}
              <CeldaPdf>{bloque.clases.map(textoEstadoDeLaHora).join('\n')}</CeldaPdf>
              {/* Los textos del bloque van una sola vez; los propios de una hora, aparte. */}
              <CeldaPdf>{textos.length === 0 ? '—' : textos.join('\n')}</CeldaPdf>
            </FilaPdf>
          )
        })}
      </TablaPdf>
    </View>
  )
}

export function HistorialPdf({ documento, ...encabezado }: DatosHistorialPdf) {
  const { alumno, mes, desde, hasta, filtros, grupos, cancelados, examenes } = documento
  const filtrosAplicados = textoFiltrosDelHistorial(filtros)

  return (
    <DocumentoOficialPdf
      titulo="Historial académico"
      referencia={textoMesDelHistorial(desde, hasta)}
      {...encabezado}
    >
      <View style={estilos.contenido}>
        <SeccionPdf>
          <CamposPdf>
            <CampoPdf label="Apellido" valor={alumno.apellido} />
            <CampoPdf label="Nombre" valor={alumno.nombre} />
            <CampoPdf label="DNI" valor={alumno.dni} />
            <CampoPdf
              label="Nivel de escolaridad"
              valor={etiquetaNivelEscolaridad(alumno.nivelEscolaridad)}
            />
            {/* Un mes completo se rotula "Mes"; cualquier otro rango, "Período" (T-163). */}
            <CampoPdf
              label={mes === null ? 'Período' : 'Mes'}
              valor={textoMesDelHistorial(desde, hasta)}
            />
            <CampoPdf label="Filtros" valor={filtrosAplicados} />
          </CamposPdf>
        </SeccionPdf>

        {grupos.length === 0 ? (
          <MensajePdf>Sin clases en el mes.</MensajePdf>
        ) : (
          grupos.map((grupo) => (
            <GrupoDelHistorialPdf key={`${grupo.materia.id}-${grupo.profesor.id}`} grupo={grupo} />
          ))
        )}

        {/* Los cancelados y los exámenes sólo se listan si hay: un mes puede tener exámenes y
            ninguna clase. */}
        {cancelados.length > 0 && (
          <Seccion titulo="Turnos cancelados del mes">
            <TablaPdf columnas={COLUMNAS_CANCELADOS} alternada>
              {cancelados.map((cancelado) => (
                <FilaPdf key={`${cancelado.turnoId}-${cancelado.fecha}-${cancelado.horaInicio}`}>
                  <CeldaPdf>{fechaConDia(cancelado.fecha)}</CeldaPdf>
                  <CeldaPdf>{rangoHoras(cancelado.horaInicio, cancelado.horaFin)}</CeldaPdf>
                  <CeldaPdf>{cancelado.materia}</CeldaPdf>
                  <CeldaPdf>{nombreProfesor(cancelado.profesor)}</CeldaPdf>
                  <CeldaPdf>{textoMotivoDeCancelado(cancelado)}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          </Seccion>
        )}

        {examenes.length > 0 && (
          <Seccion titulo="Exámenes del mes">
            <TablaPdf columnas={COLUMNAS_EXAMENES} alternada>
              {examenes.map((examen) => (
                <FilaPdf key={examen.id}>
                  <CeldaPdf>{fechaDocumento(examen.fecha)}</CeldaPdf>
                  <CeldaPdf>{examen.materiaNombre}</CeldaPdf>
                  <CeldaPdf>{textoNotaDelExamen(examen)}</CeldaPdf>
                </FilaPdf>
              ))}
            </TablaPdf>
          </Seccion>
        )}
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF del historial académico de un alumno. */
export function renderizarHistorialPdf(datos: DatosHistorialPdf): Promise<Buffer> {
  return renderizarPdf(<HistorialPdf {...datos} />)
}
