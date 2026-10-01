'use client'

import { FilterX } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'

type LimpiarFiltrosAgendaProps = {
  /**
   * La agenda filtra también por profesor (la diaria del centro): "Limpiar" lo quita junto con el
   * estado y la prioridad. En las agendas de un solo profesor ese profesor no es un filtro.
   */
  conProfesor?: boolean
}

/** "Limpiar" de los filtros de las agendas: solo se muestra si hay alguno aplicado. */
export function LimpiarFiltrosAgenda({ conProfesor = false }: LimpiarFiltrosAgendaProps) {
  const { filtros, cambiar } = useFiltrosAgenda()
  const hayFiltros =
    filtros.estado !== null ||
    filtros.prioridad !== null ||
    (conProfesor && filtros.profesorId !== null)
  if (!hayFiltros) return null

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() =>
        cambiar({ estado: null, prioridad: null, ...(conProfesor ? { profesorId: null } : {}) })
      }
    >
      <FilterX />
      Limpiar
    </Button>
  )
}
