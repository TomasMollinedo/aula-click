'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowDownAZ } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'

import type { EstadoFiltro, ProfesorListadoItem } from '../profesores.types'
import { useBuscadorProfesores } from '../hooks/use-buscador-profesores'
import { BuscadorProfesores } from './BuscadorProfesores'
import { ConfirmarEstadoProfesor } from './ConfirmarEstadoProfesor'
import { FiltroEstadoProfesores } from './FiltroEstadoProfesores'
import { FiltroMateriaProfesores } from './FiltroMateriaProfesores'
import { ProfesorEditar } from './ProfesorEditar'
import { ProfesoresTable } from './ProfesoresTable'
import { SinResultados } from './SinResultados'

const ESTADOS_VALIDOS: EstadoFiltro[] = ['ACTIVO', 'INACTIVO', 'TODOS']

type ProfesoresListadoProps = {
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
}

// La ruta llega de la página: la feature no conoce el segmento del rol (docs/arquitectura-frontend.md
// → Roles y URLs), así dos roles pueden componer el mismo listado.
export function ProfesoresListado({ rutaBase }: ProfesoresListadoProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const qUrl = searchParams.get('q') ?? ''
  const pageParam = Number(searchParams.get('page'))
  const pageUrl = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const estadoParam = searchParams.get('estado')
  const estadoUrl: EstadoFiltro = ESTADOS_VALIDOS.includes(estadoParam as EstadoFiltro)
    ? (estadoParam as EstadoFiltro)
    : 'ACTIVO'
  const materiaIdParam = Number(searchParams.get('materiaId'))
  const materiaIdUrl =
    Number.isInteger(materiaIdParam) && materiaIdParam > 0 ? materiaIdParam : null

  const onCambio = useCallback(
    ({
      q,
      page,
      estado,
      materiaId,
    }: {
      q: string
      page: number
      estado: EstadoFiltro
      materiaId: number | null
    }) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (page > 1) params.set('page', String(page))
      if (estado !== 'ACTIVO') params.set('estado', estado)
      if (materiaId != null) params.set('materiaId', String(materiaId))
      const qs = params.toString()
      router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
    },
    [router, rutaBase],
  )

  // Edición desde el lápiz de una fila: modal encima del listado, con ?editar=<id> en la URL (Atrás
  // lo cierra y recargar lo mantiene). docs/arquitectura-frontend.md → Modales con URL propia.
  const editarId = searchParams.get('editar')
  const abiertoConLapiz = useRef(false)

  const hrefEditar = useCallback(
    (id: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('editar', String(id))
      return `${rutaBase}?${params}`
    },
    [searchParams, rutaBase],
  )

  // Baja / reactivación desde el ícono de la fila: diálogo sin URL propia, igual que la baja de un
  // bloque (docs/arquitectura-frontend.md → Modales con URL propia, "confirmaciones").
  const [cambiandoEstado, setCambiandoEstado] = useState<ProfesorListadoItem | null>(null)

  const cerrarEdicion = () => {
    if (abiertoConLapiz.current) {
      abiertoConLapiz.current = false
      router.back()
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete('editar')
    const qs = params.toString()
    router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
  }

  const buscador = useBuscadorProfesores({
    controlado: { q: qUrl, page: pageUrl, estado: estadoUrl, materiaId: materiaIdUrl, onCambio },
  })
  const { meta } = buscador
  const hayFiltros = buscador.estado !== 'ACTIVO' || buscador.materiaId != null

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <BuscadorProfesores
            texto={buscador.texto}
            onChange={buscador.setTexto}
            className="w-full min-w-0 sm:max-w-md sm:flex-1"
          />
          <div className="flex shrink-0 gap-3">
            <FiltroEstadoProfesores value={buscador.estado} onChange={buscador.setEstado} />
            <FiltroMateriaProfesores value={buscador.materiaId} onChange={buscador.setMateriaId} />
          </div>
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
                ? 'No tenés permiso para ver los profesores'
                : (buscador.error?.message ?? 'Ocurrió un error inesperado')}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <ProfesoresTable
          rutaBase={rutaBase}
          hrefEditar={hrefEditar}
          onEditar={() => {
            abiertoConLapiz.current = true
          }}
          onCambiarEstado={setCambiandoEstado}
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
            {meta.total === 1 ? 'profesor' : 'profesores'}
          </p>
          <PaginationControls
            page={buscador.page}
            totalPages={meta.totalPages}
            onPageChange={buscador.setPage}
          />
        </div>
      )}

      {editarId && (
        <ProfesorEditar
          profesorId={editarId}
          mode="modal"
          onCerrar={cerrarEdicion}
          onGuardado={cerrarEdicion}
        />
      )}

      <ConfirmarEstadoProfesor
        profesor={cambiandoEstado}
        onCerrar={() => setCambiandoEstado(null)}
      />
    </Card>
  )
}
