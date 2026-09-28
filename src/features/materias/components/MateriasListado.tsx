'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowDownAZ } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'

import { useBuscadorMaterias } from '../hooks/use-buscador-materias'
import { parsearMateriaId } from '../materias.schema'
import type { EstadoFiltro, MateriaListadoItem } from '../materias.types'
import { BuscadorMaterias } from './BuscadorMaterias'
import { ConfirmarBajaMateria } from './ConfirmarBajaMateria'
import { FiltroEstadoMaterias } from './FiltroEstadoMaterias'
import { MateriaDetalleModal } from './MateriaDetalleModal'
import { MateriasTable } from './MateriasTable'
import { SinResultados } from './SinResultados'

const ESTADOS_VALIDOS: EstadoFiltro[] = ['ACTIVO', 'INACTIVO', 'TODOS']

type MateriasListadoProps = {
  /** URL del listado de materias en el segmento del rol (por ejemplo `/mesa/materias`). */
  rutaBase: string
  /** URL del listado de profesores en el segmento del rol, para enlazar a sus fichas. */
  rutaProfesores: string
}

// La ruta llega de la página: la feature no conoce el segmento del rol (docs/arquitectura-frontend.md
// → Roles y URLs), así dos roles pueden componer el mismo listado.
export function MateriasListado({ rutaBase, rutaProfesores }: MateriasListadoProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const qUrl = searchParams.get('q') ?? ''
  const pageParam = Number(searchParams.get('page'))
  const pageUrl = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const estadoParam = searchParams.get('estado')
  const estadoUrl: EstadoFiltro = ESTADOS_VALIDOS.includes(estadoParam as EstadoFiltro)
    ? (estadoParam as EstadoFiltro)
    : 'ACTIVO'

  const onCambio = useCallback(
    ({ q, page, estado }: { q: string; page: number; estado: EstadoFiltro }) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (page > 1) params.set('page', String(page))
      if (estado !== 'ACTIVO') params.set('estado', estado)
      const qs = params.toString()
      router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
    },
    [router, rutaBase],
  )

  // Detalle: modal de solo lectura encima del listado, con ?detalle=<id> en la URL (Atrás lo
  // cierra y recargar lo mantiene). docs/arquitectura-frontend.md → Modales con URL propia.
  const detalleId = parsearMateriaId(searchParams.get('detalle'))
  const abiertoConElOjo = useRef(false)

  const hrefDetalle = useCallback(
    (id: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('detalle', String(id))
      return `${rutaBase}?${params}`
    },
    [searchParams, rutaBase],
  )

  const cerrarDetalle = () => {
    if (abiertoConElOjo.current) {
      abiertoConElOjo.current = false
      router.back()
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete('detalle')
    const qs = params.toString()
    router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
  }

  // Baja desde una fila: confirmación sin URL propia, igual que la del detalle.
  const [bajaPendiente, setBajaPendiente] = useState<MateriaListadoItem | null>(null)

  const buscador = useBuscadorMaterias({
    controlado: { q: qUrl, page: pageUrl, estado: estadoUrl, onCambio },
  })
  const { meta } = buscador
  const hayFiltros = buscador.estado !== 'ACTIVO'

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <BuscadorMaterias
            texto={buscador.texto}
            onChange={buscador.setTexto}
            className="w-full min-w-0 sm:max-w-md sm:flex-1"
          />
          <div className="flex shrink-0 gap-3">
            <FiltroEstadoMaterias value={buscador.estado} onChange={buscador.setEstado} />
          </div>
        </div>
        {/* La API ordena siempre por nombre: es un indicador, no un selector. */}
        <p className="text-muted-foreground flex shrink-0 items-center gap-2 self-start text-sm whitespace-nowrap sm:self-auto">
          <ArrowDownAZ className="size-4" />
          Ordenado por nombre (A–Z)
        </p>
      </div>

      {buscador.isError ? (
        <div className="px-6 pb-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">
              {buscador.error?.status === 403
                ? 'No tenés permiso para ver las materias'
                : (buscador.error?.message ?? 'Ocurrió un error inesperado')}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <MateriasTable
          hrefDetalle={hrefDetalle}
          onVerDetalle={() => {
            abiertoConElOjo.current = true
          }}
          onDarDeBaja={setBajaPendiente}
          data={buscador.data}
          isLoading={buscador.isLoading}
          isFetching={buscador.isFetching}
          vacio={<SinResultados q={buscador.q} hayFiltros={hayFiltros} rutaBase={rutaBase} />}
        />
      )}

      {!buscador.isError && meta && meta.total > 0 && (
        <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Mostrando {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}{' '}
            {meta.total === 1 ? 'materia' : 'materias'}
          </p>
          <PaginationControls
            page={buscador.page}
            totalPages={meta.totalPages}
            onPageChange={buscador.setPage}
          />
        </div>
      )}

      {detalleId !== null && (
        <MateriaDetalleModal
          materiaId={detalleId}
          rutaProfesores={rutaProfesores}
          onCerrar={cerrarDetalle}
        />
      )}

      <ConfirmarBajaMateria
        materia={bajaPendiente}
        rutaProfesores={rutaProfesores}
        onCerrar={() => setBajaPendiente(null)}
      />
    </Card>
  )
}
