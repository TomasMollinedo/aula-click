import { StyleSheet, View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { etiquetaEstado, etiquetaPrioridad } from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaConDia, rangoHoras } from '@/server/shared/formato'
import { DestacadoPdf, MensajePdf, SeccionPdf } from '@/server/shared/pdf/campos'
import { DocumentoOficialPdf } from '@/server/shared/pdf/documento'
import { SEPARACION_BLOQUES } from '@/server/shared/pdf/estilos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import { CeldaPdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import type { AgendaDocumento } from './agendas.documentos'

// El documento PDF de la agenda diaria de un profesor (HU-11, T-60). Solo presentación: recibe lo
// que arma el service, ya filtrado y ordenado.

export type DatosAgendaPdf = EncabezadoDeDocumento & { documento: AgendaDocumento }

// Las proporciones de las columnas son las de la hoja que se imprimía desde el navegador.
const COLUMNAS: ColumnaPdf[] = [
  { titulo: 'Horario', ancho: 87.6 },
  { titulo: 'Alumno', ancho: 104 },
  { titulo: 'Profesor', ancho: 106.6 },
  { titulo: 'Materia', ancho: 74.1 },
  { titulo: 'Aula', ancho: 47.5 },
  { titulo: 'Estado', ancho: 58.6 },
]

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
})

/** `'Profesor: Bautista Cornejo · Incluye cancelados · Prioridad: Alta'`: de quién y qué se filtró. */
export function textoFiltrosDeAgenda({
  profesor,
  incluyeCancelados,
  prioridad,
}: Pick<AgendaDocumento, 'profesor' | 'incluyeCancelados' | 'prioridad'>): string {
  return [
    `Profesor: ${profesor.nombre} ${profesor.apellido}`,
    incluyeCancelados ? 'Incluye cancelados' : null,
    prioridad ? `Prioridad: ${etiquetaPrioridad(prioridad)}` : null,
  ]
    .filter((texto) => texto !== null)
    .join(' · ')
}

export function AgendaPdf({ documento, ...encabezado }: DatosAgendaPdf) {
  const { fecha, turnos } = documento
  return (
    <DocumentoOficialPdf titulo="Agenda" {...encabezado}>
      <View style={estilos.contenido}>
        <SeccionPdf>
          <DestacadoPdf titulo={fechaConDia(fecha)} nota={textoFiltrosDeAgenda(documento)} />
        </SeccionPdf>

        {turnos.length === 0 ? (
          <MensajePdf>No hay turnos para este día.</MensajePdf>
        ) : (
          <TablaPdf columnas={COLUMNAS} alternada>
            {turnos.map((turno) => (
              <FilaPdf key={`${turno.turnoId}-${turno.fecha}`}>
                <CeldaPdf>{rangoHoras(turno.horaInicio, turno.horaFin)}</CeldaPdf>
                <CeldaPdf>
                  {turno.alumno.nombre} {turno.alumno.apellido}
                </CeldaPdf>
                <CeldaPdf>
                  {turno.profesor.nombre} {turno.profesor.apellido}
                </CeldaPdf>
                <CeldaPdf>{turno.materia.nombre}</CeldaPdf>
                <CeldaPdf>{turno.aula.nombre}</CeldaPdf>
                <CeldaPdf>{etiquetaEstado(turno.estado)}</CeldaPdf>
              </FilaPdf>
            ))}
          </TablaPdf>
        )}
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF de la agenda diaria de un profesor. */
export function renderizarAgendaPdf(datos: DatosAgendaPdf): Promise<Buffer> {
  return renderizarPdf(<AgendaPdf {...datos} />)
}
