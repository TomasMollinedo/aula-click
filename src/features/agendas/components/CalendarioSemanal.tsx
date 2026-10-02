'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CalendarX2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarraFiltros } from '@/components/ui/barra-filtros'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { FiltrosAgenda } from '@/types/agenda'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { esRangoActual, moverRango } from '../agenda-propia'
import type { OrigenAgenda } from '../agendas.types'
import {
  armarSemana,
  FILTROS_GRILLA_VACIOS,
  filtrarOcurrencias,
  type FiltrosGrilla,
  filtrosDelOrigen,
  hayFiltrosGrilla,
  opcionesDeFiltros,
  tituloDeSemana,
} from '../calendario'
import { hayFiltrosActivos } from '../filtros-agenda'
import { useCalendario } from '../hooks/use-calendario'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useSemanaEnUrl } from '../hooks/use-semana-en-url'
import { CalendarioGrilla } from './CalendarioGrilla'
import { FiltroProfesorAgenda } from './FiltroProfesorAgenda'
import { FiltroCancelados, FiltroPrioridad } from './FiltrosCanceladosPrioridad'
import { FiltroAlumno, FiltroAula, FiltroMateria } from './FiltrosGrillaCalendario'
import { NavegacionFecha } from './NavegacionFecha'

export type CalendarioSemanalProps = {
  origen: OrigenAgenda
  /** Los filtros de la URL (`useFiltrosAgenda`): valen igual que en la lista. */
  filtros: FiltrosAgenda
  /**
   * Compone `app/` el detalle de un turno. Lo abre `AgendaConModo` (único dueño de `?detalle=&fecha=`,
   * `useDetalleEnUrl`) cuando el calendario navega a la URL del turno: acá no se renderiza.
   */
  renderDetalle: RenderDetalleOcurrencia
}

// Las columnas de la barra de filtros: seis campos con el profesor (el calendario del centro) y
// cinco sin él. Desde `lg` entran en una sola fila, con "Limpiar filtros" al final: los selectores
// de buscador (profesor, alumno, materia) se reparten el ancho; prioridad y aula tienen opciones
// cortas y van angostos, y estado y el botón toman lo que necesita su contenido. Desde los 1700px
// esa fila comparte renglón con la navegación por fecha (`FILA_CON_NAVEGACION`).
const COLUMNAS = {
  conProfesor: 'sm:grid-cols-2 lg:gap-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_8rem_8rem_auto_auto]',
  sinProfesor: 'sm:grid-cols-2 lg:gap-2 lg:grid-cols-[repeat(2,minmax(0,1fr))_8rem_8rem_auto_auto]',
}

// En pantallas muy anchas la navegación por fecha y los filtros van en el mismo renglón: los
// controles se alinean por abajo (la navegación no tiene label) y los filtros toman el resto.
const FILA_CON_NAVEGACION = 'min-[1700px]:flex-row min-[1700px]:items-end'

function mensajeError(origen: OrigenAgenda, error: ApiError | null): string {
  if (error?.status === 403) return 'No tenés permiso para ver esta agenda'
  if (error?.status === 404) {
    return origen.tipo === 'propia'
      ? 'Tu usuario no tiene una ficha de profesor: pedile a mesa de entradas que la revise'
      : 'Profesor no encontrado'
  }
  return error?.message ?? 'Ocurrió un error inesperado'
}

/**
 * El calendario semanal de una agenda (HU-19), del centro, de un profesor o del profesor de la
 * sesión según `origen`: navegación por semana (anterior, siguiente, "Hoy" o una fecha), los filtros
 * de la agenda y la grilla de clases. La semana va en la URL (`useSemanaEnUrl`) y los filtros de
 * estado, prioridad y profesor también (`useFiltrosAgenda`), así valen igual que en la lista; los
 * resuelve la API. Elegir un alumno, una materia y un aula son filtros propios del calendario:
 * se aplican sobre la semana que llegó y no cambian al pasar de semana. En los dos casos se ven las
 * clases con al menos un turno que coincida y, adentro, solo esos turnos.
 */
export function CalendarioSemanal({ origen, filtros }: CalendarioSemanalProps) {
  const { fecha, rango, hoy, cambiar } = useSemanaEnUrl()
  const { cambiar: cambiarFiltros } = useFiltrosAgenda()
  const query = useCalendario({ origen, rango, filtros })
  const [filtrosGrilla, setFiltrosGrilla] = useState<FiltrosGrilla>(FILTROS_GRILLA_VACIOS)
  const opciones = useMemo(() => opcionesDeFiltros(query.data ?? []), [query.data])
  const semana = useMemo(
    () => armarSemana(filtrarOcurrencias(query.data ?? [], filtrosGrilla), hoy),
    [query.data, filtrosGrilla, hoy],
  )
  const esCentro = origen.tipo === 'centro'
  const hayFiltrosApi = hayFiltrosActivos(filtrosDelOrigen(origen, filtros))
  const hayFiltros = hayFiltrosApi || hayFiltrosGrilla(filtrosGrilla)
  const status = query.error?.status

  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* La navegación por fecha y, a su lado o debajo según el ancho, los filtros. Orden: profesor,
          alumno, materia, prioridad, aula, estado. */}
      <div className={`border-border flex flex-col gap-4 border-b p-6 ${FILA_CON_NAVEGACION}`}>
        <NavegacionFecha
          fecha={fecha}
          esActual={esRangoActual('semana', fecha, hoy)}
          onAnterior={() => cambiar(moverRango('semana', fecha, -1))}
          onSiguiente={() => cambiar(moverRango('semana', fecha, 1))}
          onActual={() => cambiar(hoy)}
          onCambiarFecha={cambiar}
          textos={{
            etiqueta: tituloDeSemana(fecha),
            anterior: 'Semana anterior',
            siguiente: 'Semana siguiente',
            actual: 'Hoy',
          }}
        />
        <BarraFiltros
          hayFiltros={hayFiltros}
          onLimpiar={() => {
            setFiltrosGrilla(FILTROS_GRILLA_VACIOS)
            cambiarFiltros({
              incluirCancelados: false,
              prioridad: null,
              ...(esCentro ? { profesorId: null } : {}),
            })
          }}
          limpiarEnFila="lg"
          limpiarSoloIcono
          className={`min-w-0 min-[1700px]:flex-1 ${esCentro ? COLUMNAS.conProfesor : COLUMNAS.sinProfesor}`}
        >
          {esCentro && (
            <FiltroProfesorAgenda
              value={filtros.profesorId}
              onChange={(profesorId) => cambiarFiltros({ profesorId })}
            />
          )}
          <FiltroAlumno
            opciones={opciones.alumnos}
            value={filtrosGrilla.alumno}
            onChange={(alumno) => setFiltrosGrilla((actuales) => ({ ...actuales, alumno }))}
          />
          <FiltroMateria
            opciones={opciones.materias}
            value={filtrosGrilla.materia}
            onChange={(materia) => setFiltrosGrilla((actuales) => ({ ...actuales, materia }))}
          />
          <FiltroPrioridad />
          <FiltroAula
            opciones={opciones.aulas}
            value={filtrosGrilla.aula}
            onChange={(aula) => setFiltrosGrilla((actuales) => ({ ...actuales, aula }))}
          />
          <FiltroCancelados />
        </BarraFiltros>
      </div>

      {query.isError ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {mensajeError(origen, query.error)}
              {status !== 403 && status !== 404 && (
                <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      ) : query.isLoading ? (
        <GrillaCargando />
      ) : semana.totalClases === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={
            hayFiltros
              ? 'Sin resultados con estos filtros'
              : origen.tipo === 'propia'
                ? 'No tenés turnos esta semana'
                : 'Sin turnos esta semana'
          }
          description={
            hayFiltros
              ? 'Probá con otros filtros u otra semana.'
              : `Elegí otra semana para ver ${origen.tipo === 'propia' ? 'tu' : 'su'} agenda.`
          }
        />
      ) : (
        <CalendarioGrilla
          semana={semana}
          mostrarProfesor={esCentro}
          isFetching={query.isFetching}
        />
      )}

      {!query.isError && semana.totalClases > 0 && (
        <div className="border-border text-muted-foreground border-t px-6 py-4 text-sm">
          {semana.totalTurnos === 1 ? '1 turno' : `${semana.totalTurnos} turnos`} en{' '}
          {semana.totalClases === 1 ? '1 clase' : `${semana.totalClases} clases`}. Hacé clic en una
          clase para ver sus alumnos.
        </div>
      )}
    </Card>
  )
}

// Un esqueleto con la forma de la grilla (horas a la izquierda y columnas de días), para que la
// pantalla no salte cuando llegan los datos.
function GrillaCargando() {
  return (
    <div role="status" aria-label="Cargando el calendario" className="flex gap-3 p-6">
      <Skeleton className="h-64 w-12 shrink-0" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}
