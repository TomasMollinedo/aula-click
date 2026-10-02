'use client'

import { useId } from 'react'

import { ESTADO_TURNO, ETIQUETA_PRIORIDAD } from '@/components/turno/indicadores-turno'
import { claseControlFiltro } from '@/components/ui/barra-filtros'
import { Field } from '@/components/ui/field'
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

// Los filtros de estado y de prioridad de las agendas (HU-18), cada uno con su label, para la
// `BarraFiltros` de la lista (`BarraFiltrosAgenda`) y la del calendario (`CalendarioSemanal`).
// Escriben en `useFiltrosAgenda` (la URL), así valen igual en las dos vistas y se combinan con la
// fecha, el profesor y los demás filtros. Qué ocurrencias quedan lo decide la API.

export function FiltroEstado() {
  const id = useId()
  const { filtros, cambiar } = useFiltrosAgenda()

  return (
    <Field label="Estado" htmlFor={id}>
      <Select
        value={filtros.estado ?? TODOS}
        onValueChange={(valor) =>
          cambiar({ estado: ESTADOS_FILTRO.find((e) => e === valor) ?? null })
        }
      >
        <SelectTrigger id={id} className={claseControlFiltro(filtros.estado === null)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {ESTADOS_FILTRO.map((estado) => (
            <SelectItem key={estado} value={estado}>
              {ESTADO_TURNO[estado].etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function FiltroPrioridad() {
  const id = useId()
  const { filtros, cambiar } = useFiltrosAgenda()

  return (
    <Field label="Prioridad" htmlFor={id}>
      <Select
        value={filtros.prioridad ?? TODOS}
        onValueChange={(valor) =>
          cambiar({ prioridad: PRIORIDADES_FILTRO.find((p) => p === valor) ?? null })
        }
      >
        <SelectTrigger id={id} className={claseControlFiltro(filtros.prioridad === null)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas</SelectItem>
          {PRIORIDADES_FILTRO.map((prioridad) => (
            <SelectItem key={prioridad} value={prioridad}>
              {ETIQUETA_PRIORIDAD[prioridad]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
