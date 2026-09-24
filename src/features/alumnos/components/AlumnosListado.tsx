'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowDownAZ } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'

import { useBuscadorAlumnos } from '../hooks/use-buscador-alumnos'
import { AlumnosTable } from './AlumnosTable'
import { BuscadorAlumnos } from './BuscadorAlumnos'
import { SinResultados } from './SinResultados'

type AlumnosListadoProps = {
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
}

// La ruta llega de la página: la feature no conoce el segmento del rol (docs/arquitectura-frontend.md
// → Roles y URLs), así dos roles pueden componer el mismo listado.
export function AlumnosListado({ rutaBase }: AlumnosListadoProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const qUrl = searchParams.get('q') ?? ''
  const pageParam = Number(searchParams.get('page'))
  const pageUrl = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1

  const onCambio = useCallback(
    ({ q, page }: { q: string; page: number }) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (page > 1) params.set('page', String(page))
      const qs = params.toString()
      router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
    },
    [router, rutaBase],
  )

  const buscador = useBuscadorAlumnos({
    controlado: { q: qUrl, page: pageUrl, onCambio },
  })
  const { meta } = buscador

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <BuscadorAlumnos
          texto={buscador.texto}
          onChange={buscador.setTexto}
          className="w-full sm:max-w-md"
        />
        {/* La API ordena siempre por apellido y nombre: es un indicador, no un selector. */}
        <p className="border-border text-muted-foreground flex h-11 shrink-0 items-center gap-2 self-start rounded-lg border px-3.5 text-sm whitespace-nowrap sm:self-auto">
          <ArrowDownAZ className="size-4" />
          Ordenado por apellido (A–Z)
        </p>
      </div>

      {buscador.isError ? (
        <div className="px-6 pb-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">
              {buscador.error?.status === 403
                ? 'No tenés permiso para ver los alumnos'
                : (buscador.error?.message ?? 'Ocurrió un error inesperado')}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <AlumnosTable
          rutaBase={rutaBase}
          data={buscador.data}
          isLoading={buscador.isLoading}
          isFetching={buscador.isFetching}
          vacio={<SinResultados q={buscador.q} rutaBase={rutaBase} />}
        />
      )}

      {!buscador.isError && meta && meta.total > 0 && (
        <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Mostrando {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}{' '}
            {meta.total === 1 ? 'alumno' : 'alumnos'}
          </p>
          <PaginationControls
            page={buscador.page}
            totalPages={meta.totalPages}
            onPageChange={buscador.setPage}
          />
        </div>
      )}
    </Card>
  )
}
