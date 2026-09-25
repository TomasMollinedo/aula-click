'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, parseISO } from 'date-fns'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'

import { useAgenda } from '../hooks/use-agenda'
import { AgendaTable } from './AgendaTable'
import { FiltroProfesorAgenda } from './FiltroProfesorAgenda'
import { NavegacionFecha } from './NavegacionFecha'

const RUTA = '/mesa/agenda'
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

// El día que se propone al entrar sale del navegador (docs/arquitectura-frontend.md → Fechas y
// horas); qué turnos corresponden a "hoy" lo decide la API.
function fechaDeHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function AgendaDiariaListado() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const fechaParam = searchParams.get('fecha')
  const fecha = fechaParam && FECHA_VALIDA.test(fechaParam) ? fechaParam : fechaDeHoy()

  const profesorIdParam = Number(searchParams.get('profesorId'))
  const profesorId =
    Number.isInteger(profesorIdParam) && profesorIdParam > 0 ? profesorIdParam : null

  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1

  const actualizarUrl = useCallback(
    (cambios: { fecha?: string; profesorId?: number | null; page?: number }) => {
      const nuevaFecha = cambios.fecha ?? fecha
      const nuevoProfesorId = cambios.profesorId !== undefined ? cambios.profesorId : profesorId
      const nuevaPagina = cambios.page ?? 1

      const params = new URLSearchParams()
      if (nuevaFecha !== fechaDeHoy()) params.set('fecha', nuevaFecha)
      if (nuevoProfesorId != null) params.set('profesorId', String(nuevoProfesorId))
      if (nuevaPagina > 1) params.set('page', String(nuevaPagina))

      const qs = params.toString()
      router.replace(qs ? `${RUTA}?${qs}` : RUTA, { scroll: false })
    },
    [fecha, profesorId, router],
  )

  const irADia = (dias: number) => {
    actualizarUrl({ fecha: format(addDays(parseISO(fecha), dias), 'yyyy-MM-dd'), page: 1 })
  }
  const irAHoy = () => actualizarUrl({ fecha: fechaDeHoy(), page: 1 })
  const setFecha = (nuevaFecha: string) => actualizarUrl({ fecha: nuevaFecha, page: 1 })
  const setProfesorId = (nuevoProfesorId: number | null) =>
    actualizarUrl({ profesorId: nuevoProfesorId, page: 1 })
  const setPage = (nuevaPagina: number) => actualizarUrl({ page: nuevaPagina })

  const query = useAgenda({ fecha, profesorId: profesorId ?? undefined, page, pageSize: 20 })
  const meta = query.data?.meta

  return (
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
        <FiltroProfesorAgenda value={profesorId} onChange={setProfesorId} />
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
          hayFiltroProfesor={profesorId != null}
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
  )
}
