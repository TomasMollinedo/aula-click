'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { EstadoFiltro } from '../profesores.types'

const OPCIONES: { value: EstadoFiltro; label: string }[] = [
  { value: 'ACTIVO', label: 'Activos' },
  { value: 'INACTIVO', label: 'Inactivos' },
  { value: 'TODOS', label: 'Todos' },
]

type FiltroEstadoProfesoresProps = {
  value: EstadoFiltro
  onChange: (value: EstadoFiltro) => void
}

export function FiltroEstadoProfesores({ value, onChange }: FiltroEstadoProfesoresProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EstadoFiltro)}>
      <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPCIONES.map((opcion) => (
          <SelectItem key={opcion.value} value={opcion.value}>
            {opcion.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
