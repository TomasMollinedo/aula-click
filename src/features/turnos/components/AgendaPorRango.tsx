'use client'

import { useMemo } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ApiError } from '@/utils/fetch-json'

import {
  agruparPorFecha,
  esRangoActual,
  etiquetaDelRango,
  moverRango,
  type VistaAgenda,
} from '../agenda-propia'
import type { AgendaPropiaItem } from '../turnos.types'
import { AgendaPropiaTable, type TextosVacioAgenda } from './AgendaPropiaTable'
import { NavegacionFecha } from './NavegacionFecha'
import { SelectorVistaAgenda } from './SelectorVistaAgenda'

type AgendaPorRangoProps = {
  vista: VistaAgenda
  /** Fecha que identifica el rango, ya normalizada (en la vista semanal, el lunes). */
  fecha: string
  /** Hoy, para "Hoy" / "Esta semana". */
  hoy: string
  onCambiar: (cambios: { vista?: VistaAgenda; fecha?: string }) => void
  /** Estado de la query de la agenda del rango. */
  query: {
    data?: AgendaPropiaItem[]
    isLoading: boolean
    isFetching: boolean
    isError: boolean
    error: ApiError | null
    refetch: () => unknown
  }
  /** Texto del error. En un 403 o un 404 no se ofrece "Reintentar": no cambia reintentando. */
  mensajeError: (error: ApiError | null) => string
  /** Textos del estado vacío de la tabla; por defecto, los de "Mi agenda". */
  textosVacio?: TextosVacioAgenda
}

/**
 * Agenda por día o por semana, de sólo lectura: navegación entre rangos, selector de vista, tabla
 * agrupada por fecha, error y pie con el total. Es controlada: no conoce el endpoint ni la URL. La
 * usan "Mi agenda" (HU-10, T-26) y la agenda de la ficha del profesor (HU-02).
 */
export function AgendaPorRango({
  vista,
  fecha,
  hoy,
  onCambiar,
  query,
  mensajeError,
  textosVacio,
}: AgendaPorRangoProps) {
  const dias = useMemo(() => agruparPorFecha(query.data ?? []), [query.data])
  const total = query.data?.length ?? 0
  const status = query.error?.status

  const textos = {
    etiqueta: etiquetaDelRango(vista, fecha),
    anterior: vista === 'dia' ? 'Día anterior' : 'Semana anterior',
    siguiente: vista === 'dia' ? 'Día siguiente' : 'Semana siguiente',
    actual: vista === 'dia' ? 'Hoy' : 'Esta semana',
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-border flex flex-col gap-4 border-b p-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <NavegacionFecha
          fecha={fecha}
          esActual={esRangoActual(vista, fecha, hoy)}
          onAnterior={() => onCambiar({ fecha: moverRango(vista, fecha, -1) })}
          onSiguiente={() => onCambiar({ fecha: moverRango(vista, fecha, 1) })}
          onActual={() => onCambiar({ fecha: hoy })}
          onCambiarFecha={(nueva) => onCambiar({ fecha: nueva })}
          textos={textos}
        />
        <SelectorVistaAgenda value={vista} onChange={(nueva) => onCambiar({ vista: nueva })} />
      </div>

      {query.isError ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {mensajeError(query.error)}
              {status !== 403 && status !== 404 && (
                <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <AgendaPropiaTable
          dias={dias}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          vista={vista}
          textosVacio={textosVacio}
        />
      )}

      {!query.isError && total > 0 && (
        <div className="border-border text-muted-foreground border-t px-6 py-4 text-sm">
          {total === 1 ? '1 turno' : `${total} turnos`}{' '}
          {vista === 'dia' ? 'este día' : 'esta semana'}
        </div>
      )}
    </Card>
  )
}
