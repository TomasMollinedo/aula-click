import { useCallback, useEffect, useRef, useState } from 'react'

import type { EstadoFiltro, ListarProfesoresParams } from '../profesores.types'
import { useProfesores } from './use-profesores'

const DEBOUNCE_MS = 300

type EstadoControlado = {
  /** q de la URL. Si cambia desde afuera (Atrás, un Link al listado), el buscador se sincroniza. */
  q: string
  /** page de la URL. Ídem. */
  page: number
  /** estado de la URL (filtro Activos/Inactivos/Todos). Ídem. */
  estado: EstadoFiltro
  /** materiaId de la URL (filtro por materia). Ídem. */
  materiaId: number | null
  /** Se llama solo cuando algo cambia (no por cada tecla del buscador). */
  onCambio: (params: {
    q: string
    page: number
    estado: EstadoFiltro
    materiaId: number | null
  }) => void
}

type OpcionesBuscador = {
  controlado?: EstadoControlado
}

export function useBuscadorProfesores(opciones: OpcionesBuscador = {}) {
  const { controlado } = opciones

  // texto es siempre estado interno: el input se actualiza por cada tecla.
  const [texto, setTextoInterno] = useState(controlado?.q ?? '')
  const [page, setPageInterno] = useState(controlado?.page ?? 1)
  const [estado, setEstadoInterno] = useState<EstadoFiltro>(controlado?.estado ?? 'ACTIVO')
  const [materiaId, setMateriaIdInterno] = useState<number | null>(controlado?.materiaId ?? null)

  // Debounce propio (no useDebounce): la sincronización con la URL tiene que poder fijar q al
  // instante; con un q atrasado, el aviso de abajo volvería a escribir la búsqueda vieja en la URL.
  const [q, setQ] = useState(texto)
  useEffect(() => {
    if (texto === q) return
    const timeout = setTimeout(() => setQ(texto), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [texto, q])

  // Último estado en que coinciden el buscador y la URL: evita avisar lo que vino de la URL y
  // re-sincronizar lo que el propio buscador acaba de escribir en ella.
  const sincronizado = useRef({
    q: controlado?.q ?? '',
    page: controlado?.page ?? 1,
    estado: controlado?.estado ?? 'ACTIVO',
    materiaId: controlado?.materiaId ?? null,
  })

  const qUrl = controlado?.q
  const pageUrl = controlado?.page
  const estadoUrl = controlado?.estado
  const materiaIdUrl = controlado?.materiaId
  useEffect(() => {
    if (qUrl === undefined || pageUrl === undefined || estadoUrl === undefined) return
    if (
      qUrl === sincronizado.current.q &&
      pageUrl === sincronizado.current.page &&
      estadoUrl === sincronizado.current.estado &&
      materiaIdUrl === sincronizado.current.materiaId
    ) {
      return
    }
    sincronizado.current = {
      q: qUrl,
      page: pageUrl,
      estado: estadoUrl,
      materiaId: materiaIdUrl ?? null,
    }
    setTextoInterno(qUrl)
    setQ(qUrl)
    setPageInterno(pageUrl)
    setEstadoInterno(estadoUrl)
    setMateriaIdInterno(materiaIdUrl ?? null)
  }, [qUrl, pageUrl, estadoUrl, materiaIdUrl])

  // Notificar al controlador solo cuando algo cambia, no por cada tecla.
  useEffect(() => {
    if (
      q === sincronizado.current.q &&
      page === sincronizado.current.page &&
      estado === sincronizado.current.estado &&
      materiaId === sincronizado.current.materiaId
    ) {
      return
    }
    sincronizado.current = { q, page, estado, materiaId }
    controlado?.onCambio({ q, page, estado, materiaId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controlado.onCambio es estable (useCallback en el consumidor)
  }, [q, page, estado, materiaId])

  const setTexto = useCallback((nuevoTexto: string) => {
    setTextoInterno(nuevoTexto)
    setPageInterno(1)
  }, [])

  const setPage = useCallback((nuevaPagina: number) => {
    setPageInterno(nuevaPagina)
  }, [])

  const setEstado = useCallback((nuevoEstado: EstadoFiltro) => {
    setEstadoInterno(nuevoEstado)
    setPageInterno(1)
  }, [])

  const setMateriaId = useCallback((nuevaMateriaId: number | null) => {
    setMateriaIdInterno(nuevaMateriaId)
    setPageInterno(1)
  }, [])

  const params: ListarProfesoresParams = {
    q: q || undefined,
    page,
    estado,
    materiaId: materiaId ?? undefined,
  }

  const query = useProfesores(params)

  return {
    texto,
    setTexto,
    q,
    page,
    setPage,
    estado,
    setEstado,
    materiaId,
    setMateriaId,
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  }
}
