'use client'

import { type ReactNode, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, parseISO } from 'date-fns'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'
import type { FiltrosAgenda } from '@/types/agenda'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

import { hayFiltrosActivos, paramsDeEstadoYPrioridad } from '../filtros-agenda'
import { useAgenda } from '../hooks/use-agenda'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { AgendaConModo } from './AgendaConModo'
import { AgendaTable } from './AgendaTable'
import { CalendarioSemanal } from './CalendarioSemanal'
import { FiltroProfesorAgenda } from './FiltroProfesorAgenda'
import { FiltrosEstadoPrioridad } from './FiltrosEstadoPrioridad'
import { LimpiarFiltrosAgenda } from './LimpiarFiltrosAgenda'
import { NavegacionFecha } from './NavegacionFecha'

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

// El día que se propone al entrar sale del navegador (docs/arquitectura-frontend.md → Fechas y
// horas); qué turnos corresponden a "hoy" lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

type AgendaDiariaListadoProps = {
  /** Compone `app/` el detalle de un turno (`?detalle=&fecha=`). */
  renderDetalle: RenderDetalleOcurrencia
  /** Compone `app/` el botón del PDF de la agenda del día (es de `features/documentos`). */
  renderPdf?: (pdf: { fecha: string; filtros: FiltrosAgenda }) => ReactNode
}

export function AgendaDiariaListado({ renderDetalle, renderPdf }: AgendaDiariaListadoProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { filtros, cambiar: cambiarFiltros } = useFiltrosAgenda()

  const fechaParam = searchParams.get('fecha')
  const fecha = fechaParam && FECHA_VALIDA.test(fechaParam) ? fechaParam : fechaDeHoy()

  const profesorId = filtros.profesorId

  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1

  // La fecha y la página se escriben sobre los demás parámetros (filtros, detalle…); los filtros
  // los maneja `useFiltrosAgenda`.
  const actualizarUrl = useCallback(
    (cambios: { fecha?: string; page?: number }) => {
      const nuevaFecha = cambios.fecha ?? fecha
      const nuevaPagina = cambios.page ?? 1

      const params = new URLSearchParams(searchParams.toString())
      if (nuevaFecha !== fechaDeHoy()) params.set('fecha', nuevaFecha)
      else params.delete('fecha')
      if (nuevaPagina > 1) params.set('page', String(nuevaPagina))
      else params.delete('page')

      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [fecha, pathname, router, searchParams],
  )

  const irADia = (dias: number) => {
    actualizarUrl({ fecha: format(addDays(parseISO(fecha), dias), 'yyyy-MM-dd'), page: 1 })
  }
  const irAHoy = () => actualizarUrl({ fecha: fechaDeHoy(), page: 1 })
  const setFecha = (nuevaFecha: string) => actualizarUrl({ fecha: nuevaFecha, page: 1 })
  const setProfesorId = (nuevoProfesorId: number | null) =>
    cambiarFiltros({ profesorId: nuevoProfesorId })
  const setPage = (nuevaPagina: number) => actualizarUrl({ page: nuevaPagina })

  const query = useAgenda({
    fecha,
    profesorId: profesorId ?? undefined,
    ...paramsDeEstadoYPrioridad(filtros),
    page,
    pageSize: 20,
  })
  const meta = query.data?.meta

  return (
    <AgendaConModo
      enEncabezado="titulo"
      renderDetalle={renderDetalle}
      renderCalendario={(filtrosDelCalendario) => (
        <CalendarioSemanal
          origen={{ tipo: 'centro' }}
          filtros={filtrosDelCalendario}
          renderDetalle={renderDetalle}
        />
      )}
      acciones={renderPdf?.({ fecha, filtros })}
    >
      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-border flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
          <NavegacionFecha
            fecha={fecha}
            esActual={fecha === fechaDeHoy()}
            onAnterior={() => irADia(-1)}
            onSiguiente={() => irADia(1)}
            onActual={irAHoy}
            onCambiarFecha={setFecha}
          />
          <div className="flex flex-wrap items-center gap-2">
            <FiltrosEstadoPrioridad />
            <FiltroProfesorAgenda value={profesorId} onChange={setProfesorId} />
            <LimpiarFiltrosAgenda conProfesor />
          </div>
        </div>

        {query.isError ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">
                {query.error?.status === 403
                  ? 'No tenés permiso para ver la agenda'
                  : (query.error?.message ?? 'Ocurrió un error inesperado')}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <AgendaTable
            data={query.data?.data}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            hayFiltros={hayFiltrosActivos(filtros)}
          />
        )}

        {!query.isError && meta && meta.total > 0 && (
          <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              Mostrando {(meta.page - 1) * meta.pageSize + 1}–
              {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}{' '}
              {meta.total === 1 ? 'turno' : 'turnos'}
            </p>
            <PaginationControls page={page} totalPages={meta.totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </AgendaConModo>
  )
}
