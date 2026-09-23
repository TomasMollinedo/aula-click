import { useCallback, useEffect, useRef, useState } from 'react'

import { useDebounce } from '@/hooks/use-debounce'

import type { ListarAlumnosParams } from '../alumnos.types'
import { useAlumnos } from './use-alumnos'

type EstadoControlado = {
  /** Valor inicial de q (de la URL). */
  q: string
  /** Valor inicial de page (de la URL). */
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

  const q = useDebounce(texto, 300)

  // Notificar al controlador solo cuando q o page cambian, no por cada tecla.
  const esInicial = useRef(true)
  useEffect(() => {
    // No disparar onCambio en el mount con los valores iniciales.
    if (esInicial.current) {
      esInicial.current = false
      return
    }
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
