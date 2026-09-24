'use client'

import Link from 'next/link'
import { BookOpen, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

type SinResultadosProps = {
  q: string
  /** true si el filtro de estado no es "Activas", además de la búsqueda. */
  hayFiltros: boolean
  /** URL del listado de materias en el segmento del rol (por ejemplo `/mesa/materias`). */
  rutaBase: string
}

export function SinResultados({ q, hayFiltros, rutaBase }: SinResultadosProps) {
  const hayBusqueda = q.length > 0 || hayFiltros

  return (
    <EmptyState
      icon={hayBusqueda ? Search : BookOpen}
      title={
        hayBusqueda
          ? `No se encontraron materias${q ? ` para «${q}»` : ''}`
          : 'Todavía no hay materias cargadas'
      }
      description={
        hayBusqueda
          ? 'Probá con otro nombre, o cambiá el filtro de estado.'
          : 'Dá de alta la primera.'
      }
      className="py-20"
    >
      <Button size="lg" asChild>
        <Link href={`${rutaBase}/nueva`}>
          <Plus />
          Dar de alta una nueva materia
        </Link>
      </Button>
    </EmptyState>
  )
}
