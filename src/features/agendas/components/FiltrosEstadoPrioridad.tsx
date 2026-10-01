'use client'

import { FilterX } from 'lucide-react'

import { ESTADO_TURNO, ETIQUETA_PRIORIDAD } from '@/components/turno/indicadores-turno'
import { Button } from '@/components/ui/button'
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

/**
 * Los filtros de estado y de prioridad de las agendas (HU-18). Escriben en `useFiltrosAgenda` (la
 * URL), así valen igual en la lista y en el calendario y se combinan con la fecha, el profesor y los
 * demás filtros. Qué ocurrencias quedan lo decide la API.
 */
export function FiltrosEstadoPrioridad() {
  const { filtros, cambiar } = useFiltrosAgenda()
  const hayFiltros = filtros.estado !== null || filtros.prioridad !== null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filtros de la agenda"
    >
      <Select
        value={filtros.estado ?? TODOS}
        onValueChange={(valor) =>
          cambiar({ estado: ESTADOS_FILTRO.find((e) => e === valor) ?? null })
        }
      >
        <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-44">
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

      <Select
        value={filtros.prioridad ?? TODOS}
        onValueChange={(valor) =>
          cambiar({ prioridad: PRIORIDADES_FILTRO.find((p) => p === valor) ?? null })
        }
      >
        <SelectTrigger aria-label="Filtrar por prioridad" className="w-full sm:w-48">
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

      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cambiar({ estado: null, prioridad: null })}
        >
          <FilterX />
          Limpiar
        </Button>
      )}
    </div>
  )
}
