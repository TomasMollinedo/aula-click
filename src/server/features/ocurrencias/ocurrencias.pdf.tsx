import { StyleSheet, View } from '@react-pdf/renderer'
import type { EncabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import {
  etiquetaEstado,
  etiquetaPrioridad,
  textoPeriodoSerie,
  textoTipo,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaConDia, fechaCorta, rangoHoras } from '@/server/shared/formato'
import {
  CampoPdf,
  CamposPdf,
  DestacadoPdf,
  MensajePdf,
  SeccionPdf,
} from '@/server/shared/pdf/campos'
import { DocumentoOficialPdf } from '@/server/shared/pdf/documento'
import { SEPARACION_BLOQUES } from '@/server/shared/pdf/estilos'
import { renderizarPdf } from '@/server/shared/pdf/renderizar'
import { CeldaPdf, FilaPdf, TablaPdf, type ColumnaPdf } from '@/server/shared/pdf/tabla'
import type { TurnosDelAlumnoDocumento } from './ocurrencias.documentos'
import type { OcurrenciaDetalle } from './ocurrencias.validation'

// Los documentos PDF de `ocurrencias` (HU-11, T-60): el detalle de un turno y los turnos de un
// alumno. Solo presentación: reciben lo que arma el service, ya filtrado y ordenado.

const estilos = StyleSheet.create({
  contenido: { gap: SEPARACION_BLOQUES },
})

// ---------------------------------------------------------------------------------------------
// Detalle de un turno
// ---------------------------------------------------------------------------------------------

export type DatosTurnoPdf = EncabezadoDeDocumento & { turno: OcurrenciaDetalle }

export function TurnoPdf({ turno, ...encabezado }: DatosTurnoPdf) {
  return (
    <DocumentoOficialPdf titulo="Detalle del turno" {...encabezado}>
      <View style={estilos.contenido}>
        <SeccionPdf>
          <CamposPdf>
            <CampoPdf label="Alumno" valor={`${turno.alumno.nombre} ${turno.alumno.apellido}`} />
            <CampoPdf label="DNI" valor={turno.alumno.dni} />
            <CampoPdf label="Materia" valor={turno.materia.nombre} />
            <CampoPdf
              label="Profesor"
              valor={`${turno.profesor.nombre} ${turno.profesor.apellido}`}
            />
            <CampoPdf label="Aula" valor={turno.aula.nombre} />
            <CampoPdf label="Día y horario" valor={fechaConDia(turno.fecha)} />
            <CampoPdf label="Horario" valor={rangoHoras(turno.horaInicio, turno.horaFin)} />
            <CampoPdf label="Tipo" valor={textoTipo(turno.tipo)} />
            {turno.tipo === 'RECURRENTE' ? (
              <CampoPdf label="Período de la serie" valor={textoPeriodoSerie(turno.serie)} />
            ) : null}
          </CamposPdf>
        </SeccionPdf>

        <SeccionPdf>
          <CampoPdf label="Temas a trabajar" valor={turno.temas} />
        </SeccionPdf>
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF del detalle de un turno. */
export function renderizarTurnoPdf(datos: DatosTurnoPdf): Promise<Buffer> {
  return renderizarPdf(<TurnoPdf {...datos} />)
}

// ---------------------------------------------------------------------------------------------
// Turnos de un alumno
// ---------------------------------------------------------------------------------------------

export type DatosTurnosDelAlumnoPdf = EncabezadoDeDocumento & {
  documento: TurnosDelAlumnoDocumento
}

// Las proporciones de las columnas son las de la hoja que se imprimía desde el navegador.
const COLUMNAS_TURNOS: ColumnaPdf[] = [
  { titulo: 'Fecha', ancho: 80.6 },
  { titulo: 'Horario', ancho: 78.7 },
  { titulo: 'Materia', ancho: 112.5 },
  { titulo: 'Profesor', ancho: 94.5 },
  { titulo: 'Estado', ancho: 61.8 },
  { titulo: 'Prioridad', ancho: 50.5 },
]

/** `'01/10 – 31/10'`, más `' · Selección (3)'` o `' · Estado: Agendado'` si se filtró. */
export function textoRangoDeTurnos({
  desde,
  hasta,
  porSeleccion,
  estado,
  turnos,
}: TurnosDelAlumnoDocumento): string {
  const rango = `${fechaCorta(desde)} – ${fechaCorta(hasta)}`
  if (porSeleccion) return `${rango} · Selección (${turnos.length})`
  if (estado) return `${rango} · Estado: ${etiquetaEstado(estado)}`
  return rango
}

export function TurnosDelAlumnoPdf({ documento, ...encabezado }: DatosTurnosDelAlumnoPdf) {
  const { alumno, turnos } = documento
  return (
    <DocumentoOficialPdf titulo="Turnos del alumno" {...encabezado}>
      <View style={estilos.contenido}>
        <SeccionPdf>
          <DestacadoPdf
            titulo={`${alumno.nombre} ${alumno.apellido}`}
            detalle={`DNI ${alumno.dni}`}
            nota={textoRangoDeTurnos(documento)}
          />
        </SeccionPdf>

        {turnos.length === 0 ? (
          <MensajePdf>Sin turnos en ese rango.</MensajePdf>
        ) : (
          <TablaPdf columnas={COLUMNAS_TURNOS} alternada>
            {turnos.map((turno) => (
              <FilaPdf key={`${turno.turnoId}-${turno.fecha}`}>
                <CeldaPdf>{fechaConDia(turno.fecha)}</CeldaPdf>
                <CeldaPdf>{rangoHoras(turno.horaInicio, turno.horaFin)}</CeldaPdf>
                <CeldaPdf>{turno.materia.nombre}</CeldaPdf>
                <CeldaPdf>
                  {turno.profesor.nombre} {turno.profesor.apellido}
                </CeldaPdf>
                <CeldaPdf>{etiquetaEstado(turno.estado)}</CeldaPdf>
                <CeldaPdf>{turno.prioridad ? etiquetaPrioridad(turno.prioridad) : '—'}</CeldaPdf>
              </FilaPdf>
            ))}
          </TablaPdf>
        )}
      </View>
    </DocumentoOficialPdf>
  )
}

/** Los bytes del PDF de los turnos de un alumno. */
export function renderizarTurnosDelAlumnoPdf(datos: DatosTurnosDelAlumnoPdf): Promise<Buffer> {
  return renderizarPdf(<TurnosDelAlumnoPdf {...datos} />)
}
