'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { ConfirmarReactivacionMateria } from './ConfirmarReactivacionMateria'
import { FiltroEstadoMaterias } from './FiltroEstadoMaterias'
import { MateriaDetalleModal } from './MateriaDetalleModal'
import { MateriaEditar } from './MateriaEditar'
import { MateriasTable } from './MateriasTable'
import { SinResultados } from './SinResultados'

const ESTADOS_VALIDOS: EstadoFiltro[] = ['ACTIVO', 'INACTIVO', 'TODOS']

type MateriasListadoProps = {
  /** URL del listado de materias en el segmento del rol (por ejemplo `/mesa/materias`). */
  rutaBase: string
  /**
   * URL del listado de profesores en el segmento del rol, para enlazar a sus fichas. Sin ella (el
   * menú del gerente no tiene "Profesores") se listan sin enlace.
   */
  rutaProfesores?: string
  /**
   * Ofrece el alta, la edición, la baja y la reactivación. Lo decide la página según el segmento
   * (solo el gerente administra el catálogo, HU-12); es ayuda visual: la seguridad es el 403.
   */
  puedeEscribir: boolean
}

// La ruta llega de la página: la feature no conoce el segmento del rol (docs/arquitectura-frontend.md
// → Roles y URLs), así dos roles pueden componer el mismo listado.
export function MateriasListado({ rutaBase, rutaProfesores, puedeEscribir }: MateriasListadoProps) {
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

  // Detalle (`?detalle=<id>`) y edición (`?editar=<id>`): modales encima del listado, con URL
  // propia (Atrás los cierra y recargar los mantiene). La edición se abre con el lápiz de la fila
  // o con "Editar" del detalle, que cambia un parámetro por el otro, igual que el horario del
  // profesor.
  // docs/arquitectura-frontend.md → Modales con URL propia.
  const detalleId = parsearMateriaId(searchParams.get('detalle'))
  const editarParam = searchParams.get('editar')

  // Modales abiertos con un link de esta pantalla que siguen en el historial: cada link suma uno y
  // cerrar vuelve atrás mientras queden. Así, detalle → Editar → cerrar vuelve al detalle, y
  // cerrarlo vuelve al listado sin dejar entradas repetidas; desde el lápiz, vuelve al listado. Entrando por URL no hay historial
  // propio: cerrar reemplaza la URL.
  const modalesAbiertos = useRef(0)
  const marcarAbierto = useCallback(() => {
    modalesAbiertos.current += 1
  }, [])

  const hrefCon = useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) params.delete(clave)
        else params.set(clave, valor)
      }
      const qs = params.toString()
      return qs ? `${rutaBase}?${qs}` : rutaBase
    },
    [searchParams, rutaBase],
  )

  const hrefDetalle = useCallback(
    (id: number) => hrefCon({ detalle: String(id), editar: null }),
    [hrefCon],
  )
  const hrefEditar = (id: number) => hrefCon({ editar: String(id), detalle: null })

  const cerrarDetalle = () => {
    if (modalesAbiertos.current > 0) {
      modalesAbiertos.current -= 1
      router.back()
      return
    }
    router.replace(hrefCon({ detalle: null }), { scroll: false })
  }

  // Cerrar o guardar la edición vuelve a donde se abrió; entrando por URL, al detalle de la
  // materia (docs/arquitectura-frontend.md → Modales con URL propia).
  const cerrarEdicion = () => {
    if (modalesAbiertos.current > 0) {
      modalesAbiertos.current -= 1
      router.back()
      return
    }
    const id = parsearMateriaId(editarParam)
    router.replace(hrefCon({ editar: null, detalle: id === null ? null : String(id) }), {
      scroll: false,
    })
  }

  // La URL sigue la misma ayuda visual que los botones: sin permiso de escritura (mesa de
  // entradas) no se monta la edición y se saca el parámetro. La regla la decide la API.
  const edicionDescartada = editarParam !== null && !puedeEscribir
  useEffect(() => {
    if (edicionDescartada) router.replace(hrefCon({ editar: null }), { scroll: false })
  }, [edicionDescartada, router, hrefCon])

  // Baja y reactivación desde una fila: confirmación sin URL propia, igual que las del detalle.
  const [bajaPendiente, setBajaPendiente] = useState<MateriaListadoItem | null>(null)
  const [reactivacionPendiente, setReactivacionPendiente] = useState<MateriaListadoItem | null>(
    null,
  )

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
          onVerDetalle={marcarAbierto}
          puedeEscribir={puedeEscribir}
          hrefEditar={hrefEditar}
          onEditar={marcarAbierto}
          onDarDeBaja={setBajaPendiente}
          onReactivar={setReactivacionPendiente}
          data={buscador.data}
          isLoading={buscador.isLoading}
          isFetching={buscador.isFetching}
          vacio={
            <SinResultados
              q={buscador.q}
              hayFiltros={hayFiltros}
              rutaBase={rutaBase}
              puedeEscribir={puedeEscribir}
            />
          }
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
          puedeEscribir={puedeEscribir}
          hrefEditar={hrefEditar(detalleId)}
          onEditar={marcarAbierto}
          onCerrar={cerrarDetalle}
        />
      )}

      {editarParam !== null && puedeEscribir && (
        <MateriaEditar
          materiaId={parsearMateriaId(editarParam)}
          mode="modal"
          onCerrar={cerrarEdicion}
          onGuardada={cerrarEdicion}
        />
      )}

      {puedeEscribir && (
        <>
          <ConfirmarBajaMateria
            materia={bajaPendiente}
            rutaProfesores={rutaProfesores}
            onCerrar={() => setBajaPendiente(null)}
          />
          <ConfirmarReactivacionMateria
            materia={reactivacionPendiente}
            hrefEditar={reactivacionPendiente ? hrefEditar(reactivacionPendiente.id) : rutaBase}
            onEditar={marcarAbierto}
            onCerrar={() => setReactivacionPendiente(null)}
          />
        </>
      )}
    </Card>
  )
}
