import { useCallback, useEffect, useRef, useState } from 'react'

import type { ListarMisAlumnosParams } from '../alumnos.types'
import { useMisAlumnos } from './use-mis-alumnos'

const DEBOUNCE_MS = 300

type EstadoControlado = {
  /** q de la URL. Si cambia desde afuera (Atrás, un Link al listado), el buscador se sincroniza. */
  q: string
  /** page de la URL. Ídem. */
  page: number
  /** materiaId de la URL (filtro por materia). Ídem. */
  materiaId: number | null
  /** Se llama solo cuando algo cambia (no por cada tecla del buscador). */
  onCambio: (params: { q: string; page: number; materiaId: number | null }) => void
}

type OpcionesBuscador = {
  controlado?: EstadoControlado
}

export function useBuscadorMisAlumnos(opciones: OpcionesBuscador = {}) {
  const { controlado } = opciones

  // texto es siempre estado interno: el input se actualiza por cada tecla.
  const [texto, setTextoInterno] = useState(controlado?.q ?? '')
  const [page, setPageInterno] = useState(controlado?.page ?? 1)
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
    materiaId: controlado?.materiaId ?? null,
  })

  const qUrl = controlado?.q
  const pageUrl = controlado?.page
  const materiaIdUrl = controlado?.materiaId
  useEffect(() => {
    if (qUrl === undefined || pageUrl === undefined) return
    if (
      qUrl === sincronizado.current.q &&
      pageUrl === sincronizado.current.page &&
      materiaIdUrl === sincronizado.current.materiaId
    ) {
      return
    }
    sincronizado.current = { q: qUrl, page: pageUrl, materiaId: materiaIdUrl ?? null }
    setTextoInterno(qUrl)
    setQ(qUrl)
    setPageInterno(pageUrl)
    setMateriaIdInterno(materiaIdUrl ?? null)
  }, [qUrl, pageUrl, materiaIdUrl])

  // Notificar al controlador solo cuando algo cambia, no por cada tecla.
  useEffect(() => {
    if (
      q === sincronizado.current.q &&
      page === sincronizado.current.page &&
      materiaId === sincronizado.current.materiaId
    ) {
      return
    }
    sincronizado.current = { q, page, materiaId }
    controlado?.onCambio({ q, page, materiaId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controlado.onCambio es estable (useCallback en el consumidor)
  }, [q, page, materiaId])

  const setTexto = useCallback((nuevoTexto: string) => {
    setTextoInterno(nuevoTexto)
    setPageInterno(1)
  }, [])

  const setPage = useCallback((nuevaPagina: number) => {
    setPageInterno(nuevaPagina)
  }, [])

  const setMateriaId = useCallback((nuevaMateriaId: number | null) => {
    setMateriaIdInterno(nuevaMateriaId)
    setPageInterno(1)
  }, [])

  const params: ListarMisAlumnosParams = {
    q: q || undefined,
    page,
    materiaId: materiaId ?? undefined,
  }

  const query = useMisAlumnos(params)

  return {
    texto,
    setTexto,
    q,
    page,
    setPage,
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
