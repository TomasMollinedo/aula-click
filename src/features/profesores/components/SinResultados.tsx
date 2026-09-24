'use client'

import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

type SinResultadosProps = {
  q: string
  /** true si hay algún filtro (estado distinto de "Activos" o una materia) además de la búsqueda. */
  hayFiltros: boolean
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
}

export function SinResultados({ q, hayFiltros, rutaBase }: SinResultadosProps) {
  const hayBusqueda = q.length > 0 || hayFiltros

  return (
    <EmptyState
      icon={hayBusqueda ? Search : Users}
      title={
        hayBusqueda
          ? `No se encontraron profesores${q ? ` para «${q}»` : ''}`
          : 'Todavía no hay profesores cargados'
      }
      description={
        hayBusqueda
          ? 'Probá con otro DNI, nombre o apellido, o cambiá los filtros.'
          : 'Dá de alta el primero.'
      }
      className="py-20"
    >
      <Button size="lg" asChild>
        <Link href={`${rutaBase}/nuevo`}>
          <Plus />
          Dar de alta un nuevo profesor
        </Link>
      </Button>
    </EmptyState>
  )
}
