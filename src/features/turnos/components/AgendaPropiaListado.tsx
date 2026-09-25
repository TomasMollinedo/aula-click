'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import {
  agruparPorFecha,
  esRangoActual,
  etiquetaDelRango,
  moverRango,
  normalizarFecha,
  parsearVista,
  rangoDeVista,
  type VistaAgenda,
} from '../agenda-propia'
import { useAgendaPropia } from '../hooks/use-agenda-propia'
import { AgendaPropiaTable } from './AgendaPropiaTable'
import { NavegacionFecha } from './NavegacionFecha'
import { SelectorVistaAgenda } from './SelectorVistaAgenda'

const RUTA = '/profesor/agenda'
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

// El día que se propone al entrar sale del navegador (docs/arquitectura-frontend.md → Fechas y
// horas); qué turnos corresponden a cada fecha lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Agenda propia del profesor (HU-10, T-26), de sólo lectura: sin acciones que modifiquen un turno,
 * porque la API no las soporta en este incremento. La vista (`?vista=dia|semana`) y la fecha
 * (`?fecha=`) van en la URL con `router.replace`, como los filtros del resto de los listados, para
 * que Atrás conserve lo que se estaba viendo. Los valores por defecto (día de hoy) no se escriben.
 */
export function AgendaPropiaListado() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const vista = parsearVista(searchParams.get('vista'))
  const fechaParam = searchParams.get('fecha')
  const fecha = normalizarFecha(
    vista,
    fechaParam && FECHA_VALIDA.test(fechaParam) ? fechaParam : fechaDeHoy(),
  )
  const rango = rangoDeVista(vista, fecha)

  const actualizarUrl = useCallback(
    (cambios: { vista?: VistaAgenda; fecha?: string }) => {
      const nuevaVista = cambios.vista ?? vista
      // La fecha se normaliza con la vista nueva: pasar a semana muestra la semana de ese día.
      const nuevaFecha = normalizarFecha(nuevaVista, cambios.fecha ?? fecha)

      const params = new URLSearchParams()
      if (nuevaVista !== 'dia') params.set('vista', nuevaVista)
      if (!esRangoActual(nuevaVista, nuevaFecha, fechaDeHoy())) params.set('fecha', nuevaFecha)

      const qs = params.toString()
      router.replace(qs ? `${RUTA}?${qs}` : RUTA, { scroll: false })
    },
    [fecha, router, vista],
  )

  const query = useAgendaPropia(rango)
  const dias = useMemo(() => agruparPorFecha(query.data ?? []), [query.data])
  const total = query.data?.length ?? 0

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
          esActual={esRangoActual(vista, fecha, fechaDeHoy())}
          onAnterior={() => actualizarUrl({ fecha: moverRango(vista, fecha, -1) })}
          onSiguiente={() => actualizarUrl({ fecha: moverRango(vista, fecha, 1) })}
          onActual={() => actualizarUrl({ fecha: fechaDeHoy() })}
          onCambiarFecha={(nueva) => actualizarUrl({ fecha: nueva })}
          textos={textos}
        />
        <SelectorVistaAgenda value={vista} onChange={(nueva) => actualizarUrl({ vista: nueva })} />
      </div>

      {query.isError ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {query.error?.status === 403
                ? 'No tenés permiso para ver esta agenda'
                : query.error?.status === 404
                  ? 'Tu usuario no tiene una ficha de profesor: pedile a mesa de entradas que la revise'
                  : (query.error?.message ?? 'Ocurrió un error inesperado')}
              {query.error?.status !== 403 && query.error?.status !== 404 && (
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
