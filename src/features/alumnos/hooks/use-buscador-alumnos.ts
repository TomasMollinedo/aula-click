import { useCallback, useEffect, useRef, useState } from 'react'

import type { ListarAlumnosParams } from '../alumnos.types'
import { useAlumnos } from './use-alumnos'

const DEBOUNCE_MS = 300

type EstadoControlado = {
  /** q de la URL. Si cambia desde afuera (Atrás, un Link al listado), el buscador se sincroniza. */
  q: string
  /** page de la URL. Ídem. */
  page: number
  /** Se llama solo cuando el q debounceado o la página cambian (no por cada tecla). */
  onCambio: (params: { q: string; page: number }) => void
}

type OpcionesBuscador = {
  controlado?: EstadoControlado
  habilitarSinBusqueda?: boolean
}

export function useBuscadorAlumnos(opciones: OpcionesBuscador = {}) {
  const { controlado, habilitarSinBusqueda = true } = opciones

  // texto es siempre estado interno: el input se actualiza por cada tecla.
  const [texto, setTextoInterno] = useState(controlado?.q ?? '')
  const [page, setPageInterno] = useState(controlado?.page ?? 1)

  // Debounce propio (no useDebounce): la sincronización con la URL tiene que poder fijar q al
  // instante; con un q atrasado, el aviso de abajo volvería a escribir la búsqueda vieja en la URL.
  const [q, setQ] = useState(texto)
  useEffect(() => {
    if (texto === q) return
    const timeout = setTimeout(() => setQ(texto), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [texto, q])

  // Último { q, page } en que coinciden el buscador y la URL: evita avisar lo que vino de la URL
  // y re-sincronizar lo que el propio buscador acaba de escribir en ella.
  const sincronizado = useRef({ q: controlado?.q ?? '', page: controlado?.page ?? 1 })

  const qUrl = controlado?.q
  const pageUrl = controlado?.page
  useEffect(() => {
    if (qUrl === undefined || pageUrl === undefined) return
    if (qUrl === sincronizado.current.q && pageUrl === sincronizado.current.page) return
    sincronizado.current = { q: qUrl, page: pageUrl }
    setTextoInterno(qUrl)
    setQ(qUrl)
    setPageInterno(pageUrl)
  }, [qUrl, pageUrl])

  // Notificar al controlador solo cuando q o page cambian, no por cada tecla.
  useEffect(() => {
    if (q === sincronizado.current.q && page === sincronizado.current.page) return
    sincronizado.current = { q, page }
    controlado?.onCambio({ q, page })
  }, [q, page]) // eslint-disable-line react-hooks/exhaustive-deps -- controlado.onCambio es estable (useCallback en el consumidor)

  const setTexto = useCallback((nuevoTexto: string) => {
    setTextoInterno(nuevoTexto)
    setPageInterno(1)
  }, [])

  const setPage = useCallback((nuevaPagina: number) => {
    setPageInterno(nuevaPagina)
  }, [])

  const params: ListarAlumnosParams = { q: q || undefined, page }
  const enabled = habilitarSinBusqueda || q.length > 0

  const query = useAlumnos(params, enabled)

  return {
    texto,
    setTexto,
    q,
    page,
    setPage,
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  }
}
