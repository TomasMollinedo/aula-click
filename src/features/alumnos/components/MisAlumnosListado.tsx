'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowDownAZ } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'

import { useBuscadorMisAlumnos } from '../hooks/use-buscador-mis-alumnos'
import { BuscadorAlumnos } from './BuscadorAlumnos'
import { FiltroMateriaAlumnos } from './FiltroMateriaAlumnos'
import { MisAlumnosTable } from './MisAlumnosTable'
import { SinResultadosMisAlumnos } from './SinResultadosMisAlumnos'

type MisAlumnosListadoProps = {
  /** URL del listado de "Mis alumnos" en el segmento del rol (`/profesor/alumnos`). */
  rutaBase: string
}

// Solo lectura: sin alta ni edición (eso es de mesa de entradas). El detalle sí es el mismo que
// mesa: GET /alumnos/{id} ahora también admite PROFESOR.
export function MisAlumnosListado({ rutaBase }: MisAlumnosListadoProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const qUrl = searchParams.get('q') ?? ''
  const pageParam = Number(searchParams.get('page'))
  const pageUrl = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const materiaIdParam = Number(searchParams.get('materiaId'))
  const materiaIdUrl =
    Number.isInteger(materiaIdParam) && materiaIdParam > 0 ? materiaIdParam : null

  const onCambio = useCallback(
    ({ q, page, materiaId }: { q: string; page: number; materiaId: number | null }) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (page > 1) params.set('page', String(page))
      if (materiaId != null) params.set('materiaId', String(materiaId))
      const qs = params.toString()
      router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
    },
    [router, rutaBase],
  )

  const buscador = useBuscadorMisAlumnos({
    controlado: { q: qUrl, page: pageUrl, materiaId: materiaIdUrl, onCambio },
  })
  const { meta } = buscador
  const hayFiltros = buscador.materiaId != null

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <BuscadorAlumnos
            texto={buscador.texto}
            onChange={buscador.setTexto}
            className="w-full min-w-0 sm:max-w-md sm:flex-1"
          />
          <FiltroMateriaAlumnos value={buscador.materiaId} onChange={buscador.setMateriaId} />
        </div>
        {/* La API ordena siempre por apellido y nombre: es un indicador, no un selector. */}
        <p className="text-muted-foreground flex shrink-0 items-center gap-2 self-start text-sm whitespace-nowrap sm:self-auto">
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
                ? 'No tenés permiso para ver esta lista'
                : (buscador.error?.message ?? 'Ocurrió un error inesperado')}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <MisAlumnosTable
          rutaBase={rutaBase}
          data={buscador.data}
          isLoading={buscador.isLoading}
          isFetching={buscador.isFetching}
          vacio={<SinResultadosMisAlumnos q={buscador.q} hayFiltros={hayFiltros} />}
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
