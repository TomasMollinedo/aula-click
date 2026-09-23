'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useBuscadorAlumnos } from '../hooks/use-buscador-alumnos'
import { AlumnosTable } from './AlumnosTable'
import { BuscadorAlumnos } from './BuscadorAlumnos'
import { SinResultados } from './SinResultados'

export function AlumnosListado() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const qInicial = searchParams.get('q') ?? ''
  const pageInicial = Number(searchParams.get('page')) || 1

  const onCambio = useCallback(
    ({ q, page }: { q: string; page: number }) => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (page > 1) params.set('page', String(page))
      const qs = params.toString()
      router.replace(qs ? `/mesa/alumnos?${qs}` : '/mesa/alumnos', { scroll: false })
    },
    [router],
  )

  const buscador = useBuscadorAlumnos({
    controlado: { q: qInicial, page: pageInicial, onCambio },
  })

  const sinResultados = !buscador.isLoading && !buscador.isError && buscador.data?.length === 0

  return (
    <div className="space-y-4">
      <BuscadorAlumnos texto={buscador.texto} onChange={buscador.setTexto} />

      {sinResultados ? (
        <SinResultados q={buscador.q} />
      ) : (
        <AlumnosTable
          data={buscador.data}
          meta={buscador.meta}
          isLoading={buscador.isLoading}
          isError={buscador.isError}
          error={buscador.error}
          page={buscador.page}
          onPageChange={buscador.setPage}
        />
      )}
    </div>
  )
}
