'use client'

import { Search, Users } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'

type SinResultadosMisAlumnosProps = {
  q: string
  /** true si hay un filtro de materia además de la búsqueda. */
  hayFiltros: boolean
}

// Sin CTA de alta: un profesor no da de alta alumnos (eso es de MESA_ENTRADAS).
export function SinResultadosMisAlumnos({ q, hayFiltros }: SinResultadosMisAlumnosProps) {
  const hayBusqueda = q.length > 0 || hayFiltros

  return (
    <EmptyState
      icon={hayBusqueda ? Search : Users}
      title={
        hayBusqueda
          ? `No se encontraron alumnos${q ? ` para «${q}»` : ''}`
          : 'Todavía no tenés alumnos con turnos vigentes'
      }
      description={
        hayBusqueda
          ? 'Probá con otro DNI, nombre o apellido, o cambiá el filtro de materia.'
          : 'Acá vas a ver a los alumnos con un turno activo y no vencido con vos.'
      }
      className="py-20"
    />
  )
}
