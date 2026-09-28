'use client'

import Link from 'next/link'
import { AlertCircle, Plus, Search, UserRound } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBuscadorAlumnos } from '@/features/alumnos/hooks/use-buscador-alumnos'
import { cn } from '@/utils/cn'

import type { AlumnoElegido } from '../turnos.types'

type SeleccionAlumnoProps = {
  /** URL del alta de alumno que vuelve a esta pantalla (`/mesa/alumnos/nuevo?volverA=turnos`). */
  hrefAltaAlumno: string
  onElegir: (alumno: AlumnoElegido) => void
  /** Aviso arriba del buscador (por ejemplo, el alumno de `?alumnoId=` no existe). */
  aviso?: string | null
}

/**
 * Paso 1: buscar y elegir al alumno. Usa el buscador de `alumnos` en modo interno (no toca la URL)
 * y sin pedir nada hasta que se escribe. Sin coincidencias, ofrece el alta con vuelta a turnos.
 */
export function SeleccionAlumno({ hrefAltaAlumno, onElegir, aviso }: SeleccionAlumnoProps) {
  const buscador = useBuscadorAlumnos({ habilitarSinBusqueda: false })
  const { data, meta, q } = buscador

  return (
    <div className="space-y-4">
      {aviso && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      <SearchInput
        value={buscador.texto}
        onValueChange={buscador.setTexto}
        placeholder="Buscar por DNI, nombre o apellido…"
        aria-label="Buscar alumno por DNI, nombre o apellido"
        className="w-full sm:max-w-md"
        autoFocus
      />

      {!q && (
        <p className="text-muted-foreground text-sm">
          Escribí el DNI, el nombre o el apellido del alumno.
        </p>
      )}

      {q && buscador.isLoading && (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {q && buscador.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            {buscador.error?.status === 403
              ? 'No tenés permiso para buscar alumnos'
              : (buscador.error?.message ?? 'Ocurrió un error inesperado')}
          </AlertDescription>
        </Alert>
      )}

      {q && !buscador.isLoading && !buscador.isError && data?.length === 0 && (
        <EmptyState
          icon={Search}
          title={`No encontramos alumnos para «${q}»`}
          description="Probá con otro DNI, nombre o apellido, o dalo de alta."
          className="py-10"
        >
          <Button size="lg" asChild>
            <Link href={hrefAltaAlumno}>
              <Plus />
              Dar de alta un alumno
            </Link>
          </Button>
        </EmptyState>
      )}

      {q && data && data.length > 0 && (
        <>
          <ul
            aria-label="Alumnos encontrados"
            className={cn(
              'divide-border border-border divide-y rounded-lg border',
              buscador.isFetching && 'opacity-60',
            )}
          >
            {data.map((alumno) => (
              <li key={alumno.id}>
                <button
                  type="button"
                  onClick={() => onElegir(alumno)}
                  className="hover:bg-canvas focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
                >
                  <UserRound className="text-cobalto size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {alumno.apellido}, {alumno.nombre}
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    DNI {alumno.dni}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {meta && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                {meta.total} {meta.total === 1 ? 'alumno' : 'alumnos'}
              </p>
              <PaginationControls
                page={buscador.page}
                totalPages={meta.totalPages}
                onPageChange={buscador.setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Resumen compacto del alumno elegido (el "Cambiar" lo pone la sección). */
export function ResumenAlumno({ alumno }: { alumno: AlumnoElegido }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <UserRound className="text-cobalto size-4" aria-hidden />
      <span className="font-medium">
        {alumno.apellido}, {alumno.nombre}
      </span>
      <span className="text-muted-foreground tabular-nums">DNI {alumno.dni}</span>
    </p>
  )
}
