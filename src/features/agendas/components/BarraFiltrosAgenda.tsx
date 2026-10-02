'use client'

import { BarraFiltros } from '@/components/ui/barra-filtros'

import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { FiltroProfesorAgenda } from './FiltroProfesorAgenda'
import { FiltroEstado, FiltroPrioridad } from './FiltrosEstadoPrioridad'

// Pocos campos no llenan el ancho de la tarjeta: tienen un tope y el botón va al final de la fila.
const GRILLA = {
  conProfesor: {
    limpiarEnFila: 'lg',
    className: 'sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,16rem))_1fr]',
  },
  sinProfesor: {
    limpiarEnFila: 'md',
    className: 'sm:grid-cols-2 md:grid-cols-[repeat(2,minmax(0,16rem))_1fr]',
  },
} as const

type BarraFiltrosAgendaProps = {
  /**
   * La agenda filtra también por profesor (la diaria del centro): se suma su filtro y "Limpiar
   * filtros" lo quita junto con el estado y la prioridad. En las agendas de un solo profesor ese
   * profesor no es un filtro.
   */
  conProfesor?: boolean
}

/**
 * Los filtros de la lista de una agenda (HU-18): estado, prioridad y, en la diaria, profesor, con
 * "Limpiar filtros". Lee y escribe `useFiltrosAgenda` (la URL).
 */
export function BarraFiltrosAgenda({ conProfesor = false }: BarraFiltrosAgendaProps) {
  const { filtros, cambiar } = useFiltrosAgenda()
  const hayFiltros =
    filtros.estado !== null ||
    filtros.prioridad !== null ||
    (conProfesor && filtros.profesorId !== null)

  return (
    <BarraFiltros
      hayFiltros={hayFiltros}
      onLimpiar={() =>
        cambiar({ estado: null, prioridad: null, ...(conProfesor ? { profesorId: null } : {}) })
      }
      {...(conProfesor ? GRILLA.conProfesor : GRILLA.sinProfesor)}
    >
      <FiltroEstado />
      <FiltroPrioridad />
      {conProfesor && (
        <FiltroProfesorAgenda
          value={filtros.profesorId}
          onChange={(profesorId) => cambiar({ profesorId })}
        />
      )}
    </BarraFiltros>
  )
}
