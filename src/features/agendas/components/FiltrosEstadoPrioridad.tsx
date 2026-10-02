'use client'

import { ESTADO_TURNO, ETIQUETA_PRIORIDAD } from '@/components/turno/indicadores-turno'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { ESTADOS_FILTRO, PRIORIDADES_FILTRO } from '../filtros-agenda'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'

// Radix Select no admite un valor vacío: "sin filtro" es este valor y se traduce a `null`.
const TODOS = 'TODOS'

/** El filtro de estado de las agendas (HU-18): escribe en `useFiltrosAgenda` (la URL). */
export function FiltroEstado() {
  const { filtros, cambiar } = useFiltrosAgenda()

  return (
    <Select
      value={filtros.estado ?? TODOS}
      onValueChange={(valor) =>
        cambiar({ estado: ESTADOS_FILTRO.find((e) => e === valor) ?? null })
      }
    >
      <SelectTrigger aria-label="Filtrar por estado" className="h-9 w-full rounded-md sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos los estados</SelectItem>
        {ESTADOS_FILTRO.map((estado) => (
          <SelectItem key={estado} value={estado}>
            {ESTADO_TURNO[estado].etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** El filtro de prioridad de las agendas (HU-18): escribe en `useFiltrosAgenda` (la URL). */
export function FiltroPrioridad() {
  const { filtros, cambiar } = useFiltrosAgenda()

  return (
    <Select
      value={filtros.prioridad ?? TODOS}
      onValueChange={(valor) =>
        cambiar({ prioridad: PRIORIDADES_FILTRO.find((p) => p === valor) ?? null })
      }
    >
      <SelectTrigger aria-label="Filtrar por prioridad" className="h-9 w-full rounded-md sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todas las prioridades</SelectItem>
        {PRIORIDADES_FILTRO.map((prioridad) => (
          <SelectItem key={prioridad} value={prioridad}>
            Prioridad {ETIQUETA_PRIORIDAD[prioridad].toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Los filtros de estado y de prioridad juntos, como los usa la lista (HU-18). Escriben en
 * `useFiltrosAgenda` (la URL), así valen igual en la lista y en el calendario y se combinan con la
 * fecha, el profesor y los demás filtros. Qué ocurrencias quedan lo decide la API. El calendario
 * los coloca uno por uno en su fila (`FiltroEstado`, `FiltroPrioridad`). El botón para limpiarlos
 * es aparte (`LimpiarFiltrosAgenda`): lo ubica cada agenda según sus filtros.
 */
export function FiltrosEstadoPrioridad() {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filtros de la agenda"
    >
      <FiltroEstado />
      <FiltroPrioridad />
    </div>
  )
}
