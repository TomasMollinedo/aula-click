'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { EstadoFiltro } from '../materias.types'

const OPCIONES: { value: EstadoFiltro; label: string }[] = [
  { value: 'ACTIVO', label: 'Activas' },
  { value: 'INACTIVO', label: 'Inactivas' },
  { value: 'TODOS', label: 'Todas' },
]

type FiltroEstadoMateriasProps = {
  value: EstadoFiltro
  onChange: (value: EstadoFiltro) => void
}

export function FiltroEstadoMaterias({ value, onChange }: FiltroEstadoMateriasProps) {
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
