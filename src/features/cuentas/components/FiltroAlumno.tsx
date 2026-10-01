'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { AlertCircle, UserRound, Wallet, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBuscadorAlumnos } from '@/features/alumnos/hooks/use-buscador-alumnos'
import { cn } from '@/utils/cn'

import { hrefFichaAlumno } from '../rutas-cuentas'

type AlumnoDelFiltro = { nombre: string; apellido: string; dni: string }

type FiltroAlumnoProps = {
  alumnoId: number | null
  /** El alumno filtrado (`useAlumno`), así el chip tiene nombre también al recargar. */
  alumno: AlumnoDelFiltro | undefined
  /** El alumno de la URL no existe: el chip lo dice en vez de quedar cargando. */
  noEncontrado: boolean
  onElegir: (alumnoId: number) => void
  onQuitar: () => void
}

/**
 * Filtro por alumno de la vista global "Pagos". Sin filtro, el buscador de `alumnos` (su hook, en
 * estado interno y sin pedir nada hasta que se escribe); con filtro, un chip con el alumno, "Ver
 * cuenta del alumno" (para cobrar todo o los próximos, desde la ficha) y "Quitar filtro". El
 * filtro vive en la URL: lo escribe `PagosGlobal`.
 */
export function FiltroAlumno({
  alumnoId,
  alumno,
  noEncontrado,
  onElegir,
  onQuitar,
}: FiltroAlumnoProps) {
  // Al elegir, el botón del resultado desaparece: el foco va al chip. Al quitar, al buscador. Solo
  // después de una acción, no al cargar la página con el filtro en la URL.
  const pendiente = useRef<'chip' | 'buscador' | null>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const buscadorRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pendiente.current === 'chip') chipRef.current?.focus()
    if (pendiente.current === 'buscador') buscadorRef.current?.focus()
    pendiente.current = null
  }, [alumnoId])

  if (alumnoId === null) {
    return (
      <BuscadorDelFiltro
        inputRef={buscadorRef}
        onElegir={(id) => {
          pendiente.current = 'chip'
          onElegir(id)
        }}
      />
    )
  }

  return (
    <div
      ref={chipRef}
      tabIndex={-1}
      className="flex flex-col gap-3 outline-none sm:flex-row sm:flex-wrap sm:items-center"
      aria-label="Filtro por alumno"
      role="group"
    >
      <p className="bg-canvas inline-flex min-h-9 items-center gap-2 rounded-full px-4 py-1.5 text-sm">
        <UserRound className="text-cobalto size-4 shrink-0" aria-hidden />
        {alumno ? (
          <span>
            <span className="font-medium">
              {alumno.nombre} {alumno.apellido}
            </span>
            <span className="text-muted-foreground tabular-nums"> · DNI {alumno.dni}</span>
          </span>
        ) : noEncontrado ? (
          <span className="text-muted-foreground">Alumno no encontrado</span>
        ) : (
          <Skeleton className="h-4 w-44" aria-label="Cargando el alumno" />
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {alumno && (
          <Button asChild size="sm" variant="outline">
            <Link href={hrefFichaAlumno(alumnoId)}>
              <Wallet />
              Ver cuenta del alumno
            </Link>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            pendiente.current = 'buscador'
            onQuitar()
          }}
        >
          <X />
          Quitar filtro
        </Button>
      </div>
    </div>
  )
}

function BuscadorDelFiltro({
  inputRef,
  onElegir,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onElegir: (alumnoId: number) => void
}) {
  const buscador = useBuscadorAlumnos({ habilitarSinBusqueda: false })
  const { data, meta, q } = buscador

  return (
    <div className="space-y-3">
      <SearchInput
        ref={inputRef}
        value={buscador.texto}
        onValueChange={buscador.setTexto}
        placeholder="Filtrar por alumno: DNI, nombre o apellido…"
        aria-label="Filtrar los adeudados por alumno: buscar por DNI, nombre o apellido"
        className="w-full sm:max-w-md"
      />

      {q && buscador.isLoading && (
        <div className="space-y-2" aria-busy aria-label="Buscando alumnos">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg sm:max-w-md" />
          ))}
        </div>
      )}

      {q && buscador.isError && (
        <Alert variant="destructive" className="sm:max-w-md">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            {buscador.error?.status === 403
              ? 'No tenés permiso para buscar alumnos'
              : (buscador.error?.message ?? 'Ocurrió un error inesperado')}
          </AlertDescription>
        </Alert>
      )}

      {/* Siempre montado: un aria-live que aparece junto con su contenido no se anuncia. */}
      <p className="sr-only" aria-live="polite">
        {q && meta
          ? `${meta.total} ${meta.total === 1 ? 'alumno encontrado' : 'alumnos encontrados'}`
          : ''}
      </p>

      {q && data && data.length === 0 && (
        <p className="text-muted-foreground text-sm">No encontramos alumnos para «{q}».</p>
      )}

      {q && data && data.length > 0 && (
        <div className="space-y-2 sm:max-w-md">
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
                  onClick={() => onElegir(alumno.id)}
                  className="hover:bg-canvas focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
                >
                  <UserRound className="text-cobalto size-4 shrink-0" aria-hidden />
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
            <PaginationControls
              page={buscador.page}
              totalPages={meta.totalPages}
              onPageChange={buscador.setPage}
            />
          )}
        </div>
      )}
    </div>
  )
}
