'use client'

import Link from 'next/link'
import { AlertCircle, CalendarClock, ChevronRight, GraduationCap } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { formatearPorcentaje } from '@/utils/porcentaje'

import { tituloGrupo } from '../formato-historiales'
import { useMateriasDelPortal } from '../hooks/use-materias-del-portal'
import { textoProximoTurno } from '../mis-materias'

export type MisMateriasProps = {
  /**
   * Ruta de las materias del portal (`/portal/materias`): cada materia enlaza a
   * `${rutaBase}/${materiaId}/${profesorId}`.
   */
  rutaBase: string
}

/**
 * "Mis materias" del portal del alumno (HU-33): cada materia con su profesor ("Inglés — Prof.
 * Ruiz"), su próximo turno y su porcentaje de asistencia, como los manda la API
 * (`GET /historiales/mis-materias`). Tocar una entra a su historial. Pensada para el celular: una
 * tarjeta debajo de la otra.
 */
export function MisMaterias({ rutaBase }: MisMateriasProps) {
  const query = useMateriasDelPortal()

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
          {query.error?.message ?? 'Ocurrió un error inesperado'}
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (query.isLoading) {
    return (
      <div role="status" aria-label="Cargando tus materias" className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const materias = query.data ?? []
  if (materias.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState icon={GraduationCap} title="Todavía no tenés materias" />
      </Card>
    )
  }

  return (
    <ul className="space-y-3">
      {materias.map((item) => {
        const proximo = textoProximoTurno(item.proximoTurno)
        return (
          <li key={`${item.materia.id}-${item.profesor.id}`}>
            <Link
              href={`${rutaBase}/${item.materia.id}/${item.profesor.id}`}
              className="bg-card border-border hover:bg-canvas focus-visible:ring-ring flex items-center gap-4 rounded-xl border p-4 shadow-xs transition-colors outline-none focus-visible:ring-2 sm:p-5"
            >
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="block font-semibold">{tituloGrupo(item)}</span>
                <span className="text-muted-foreground flex items-start gap-1.5 text-sm">
                  <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span className="first-letter:uppercase">
                    {proximo ? `Próximo turno: ${proximo}` : 'Sin turnos próximos'}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-lg font-semibold tabular-nums">
                  {formatearPorcentaje(item.porcentaje)}
                </span>
                <span className="text-muted-foreground text-xs">asistencia</span>
              </span>
              <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
