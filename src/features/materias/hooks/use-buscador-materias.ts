import { useCallback, useEffect, useRef, useState } from 'react'

import type { EstadoFiltro, ListarMateriasParams } from '../materias.types'
import { useMaterias } from './use-materias'

const DEBOUNCE_MS = 300

type EstadoControlado = {
  /** q de la URL. Si cambia desde afuera (Atrás, un Link al listado), el buscador se sincroniza. */
  q: string
  /** page de la URL. Ídem. */
  page: number
  /** estado de la URL (filtro Activas/Inactivas/Todas). Ídem. */
  estado: EstadoFiltro
  /** Se llama solo cuando algo cambia (no por cada tecla del buscador). */
  onCambio: (params: { q: string; page: number; estado: EstadoFiltro }) => void
}

type OpcionesBuscador = {
  controlado?: EstadoControlado
}

export function useBuscadorMaterias(opciones: OpcionesBuscador = {}) {
  const { controlado } = opciones

  // texto es siempre estado interno: el input se actualiza por cada tecla.
  const [texto, setTextoInterno] = useState(controlado?.q ?? '')
  const [page, setPageInterno] = useState(controlado?.page ?? 1)
  const [estado, setEstadoInterno] = useState<EstadoFiltro>(controlado?.estado ?? 'ACTIVO')

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
  })

  const qUrl = controlado?.q
  const pageUrl = controlado?.page
  const estadoUrl = controlado?.estado
  useEffect(() => {
    if (qUrl === undefined || pageUrl === undefined || estadoUrl === undefined) return
    if (
      qUrl === sincronizado.current.q &&
      pageUrl === sincronizado.current.page &&
      estadoUrl === sincronizado.current.estado
    ) {
      return
    }
    sincronizado.current = { q: qUrl, page: pageUrl, estado: estadoUrl }
    setTextoInterno(qUrl)
    setQ(qUrl)
    setPageInterno(pageUrl)
    setEstadoInterno(estadoUrl)
  }, [qUrl, pageUrl, estadoUrl])

  // Notificar al controlador solo cuando algo cambia, no por cada tecla.
  useEffect(() => {
    if (
      q === sincronizado.current.q &&
      page === sincronizado.current.page &&
      estado === sincronizado.current.estado
    ) {
      return
    }
    sincronizado.current = { q, page, estado }
    controlado?.onCambio({ q, page, estado })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controlado.onCambio es estable (useCallback en el consumidor)
  }, [q, page, estado])

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

  const params: ListarMateriasParams = { q: q || undefined, page, estado }

  const query = useMaterias(params)

  return {
    texto,
    setTexto,
    q,
    page,
    setPage,
    estado,
    setEstado,
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  }
}
