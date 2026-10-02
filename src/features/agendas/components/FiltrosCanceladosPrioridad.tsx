'use client'

import { useId } from 'react'

import { ETIQUETA_PRIORIDAD } from '@/components/turno/indicadores-turno'
import { claseControlFiltro } from '@/components/ui/barra-filtros'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { PRIORIDADES_FILTRO } from '../filtros-agenda'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'

// Radix Select no admite un valor vacío: "sin filtro" es este valor y se traduce a `null`.
const TODOS = 'TODOS'

// Los filtros de cancelados y de prioridad de las agendas (HU-18), cada uno con su label, para la
// `BarraFiltros` de la lista (`BarraFiltrosAgenda`) y la del calendario (`CalendarioSemanal`).
// Escriben en `useFiltrosAgenda` (la URL), así valen igual en las dos vistas y se combinan con la
// fecha, el profesor y los demás filtros. Qué ocurrencias quedan lo decide la API.

// Sin tocarlo, la agenda trae las agendadas y las sin registrar; con él, además las canceladas.
export function FiltroCancelados() {
  const id = useId()
  const { filtros, cambiar } = useFiltrosAgenda()

  return (
    <Field label="Estado" htmlFor={id}>
      <div className="flex h-9 items-center gap-2">
        <Checkbox
          id={id}
          checked={filtros.incluirCancelados}
          onCheckedChange={(marcado) => cambiar({ incluirCancelados: marcado === true })}
        />
        <Label htmlFor={id} className="font-normal whitespace-nowrap">
          Incluir cancelados
        </Label>
      </div>
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
