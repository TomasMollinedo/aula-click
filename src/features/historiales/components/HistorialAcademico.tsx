'use client'

import { useId } from 'react'
import { AlertCircle, GraduationCap, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import type { Role } from '@/types'
import { cn } from '@/utils/cn'

import { interpretarErrorHistorial } from '../errores-historiales'
import { aParams, hayFiltros } from '../filtros-historial'
import { textoPeriodo } from '../formato-historiales'
import type { OpcionesDelHistorial } from '../historiales.types'
import { useFiltrosHistorial } from '../hooks/use-filtros-historial'
import { useHistorialDelAlumno } from '../hooks/use-historial-del-alumno'
import { BarraFiltrosHistorial } from './BarraFiltrosHistorial'
import { GrupoHistorial } from './GrupoHistorial'

const SIN_OPCIONES: OpcionesDelHistorial = { materias: [], profesores: [] }

export type HistorialAcademicoProps = {
  alumnoId: number
  /**
   * Rol de quien mira. Hoy la pestaña es igual para mesa de entradas y profesor (sólo lectura en
   * los dos, HU-31); lo usa T-110 para el botón "Generar PDF", que es de mesa de entradas (HU-32).
   */
  rol: Role
  /**
   * El detalle del turno, que compone `app/` (es de `features/ocurrencias`). **Opcional**: una
   * pantalla que ya monta su propio detalle único para todas sus pestañas (la ficha de mesa de
   * entradas) no lo pasa, y entonces acá sólo se navega a `?detalle=&fecha=`
   * (docs/arquitectura-frontend.md → Acciones sobre una ocurrencia), como hace `AgendaDelAlumno`
   * con `AgendaConModo`.
   */
  renderDetalle?: RenderDetalleOcurrencia
}

/** Las tarjetas de los grupos mientras llega el historial. */
function HistorialCargando() {
  return (
    <div className="space-y-4" aria-busy>
      <span className="sr-only">Cargando el historial…</span>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="gap-4">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  )
}

/**
 * Pestaña "Historial académico" de la ficha del alumno (HU-31): las clases del período agrupadas
 * por materia y profesor, cada grupo con su resumen y sus bloques de **horas seguidas**. Los
 * filtros (un mes, por defecto el actual, o un rango, más materia y profesor) viven en la URL junto
 * al `?tab=` de la ficha.
 *
 * **La pantalla sólo pinta lo que manda la API** (T-108): el estado de cada hora, su plazo o su
 * cierre por el sistema, el porcentaje, qué textos van una sola vez y el orden de los grupos y de
 * los bloques. Acá no se agrupa, no se reordena y no se compara nada. Es de **sólo lectura** en los
 * dos roles: la asistencia se registra y se corrige desde el detalle del turno (HU-22).
 *
 * El clic en una clase navega a `?detalle=&fecha=`; quién monta el modal lo decide `app/` con
 * `renderDetalle` (ver sus props).
 */
export function HistorialAcademico({ alumnoId, renderDetalle }: HistorialAcademicoProps) {
  const id = useId()
  const { filtros, hoy, cambiar, elegirOpcion, elegirMes, cambiarRango, limpiar } =
    useFiltrosHistorial()
  const query = useHistorialDelAlumno(alumnoId, aParams(filtros))
  const historial = query.data
  const enEspera = query.isPlaceholderData

  // El detalle del turno: siempre se navega (`hrefDetalle`), y sólo se monta si quien compone la
  // pantalla no tiene ya el suyo (`renderDetalle`).
  const { detalle, hrefDetalle, marcarAbiertoConLink, cerrar } = useDetalleEnUrl()

  const error = query.isError ? interpretarErrorHistorial(query.error) : null

  return (
    <div className="space-y-4">
      <Card>
        <BarraFiltrosHistorial
          filtros={filtros}
          hoy={hoy}
          // Las del historial completo del alumno: se conservan las del pedido anterior mientras
          // llega el nuevo, así los selects no se vacían al cambiar de período.
          opciones={historial?.opciones ?? SIN_OPCIONES}
          onElegirOpcion={elegirOpcion}
          onElegirMes={elegirMes}
          onCambiarRango={cambiarRango}
          onCambiar={cambiar}
          onLimpiar={limpiar}
          puedeLimpiar={hayFiltros(filtros, hoy)}
          errores={error?.tipo === 'filtros' ? error.campos : undefined}
          errorGeneral={error?.tipo === 'filtros' ? error.mensaje : null}
        />
      </Card>

      {query.isPending ? (
        <HistorialCargando />
      ) : error ? (
        // El error de los filtros ya está junto a ellos.
        error.tipo !== 'filtros' && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
              {error.mensaje}
              {error.reintentar && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void query.refetch()}
                >
                  <RotateCw />
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )
      ) : (
        historial && (
          <div className={cn('space-y-4', enEspera && 'opacity-60')}>
            {historial.grupos.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon={GraduationCap}
                  title="No hay clases registradas en este período"
                  // El período que devolvió la API, no el elegido: lo que se ve es de ese período.
                  description={`No se encontraron clases ${textoPeriodo(historial.desde, historial.hasta)}.`}
                />
              </Card>
            ) : (
              historial.grupos.map((grupo) => (
                <GrupoHistorial
                  key={`${grupo.materia.id}-${grupo.profesor.id}`}
                  grupo={grupo}
                  id={`${id}-${grupo.materia.id}-${grupo.profesor.id}`}
                  hrefDetalle={hrefDetalle}
                  onAbrirDetalle={marcarAbiertoConLink}
                />
              ))
            )}
          </div>
        )
      )}

      {detalle && renderDetalle?.({ ...detalle, onCerrar: cerrar })}
    </div>
  )
}
