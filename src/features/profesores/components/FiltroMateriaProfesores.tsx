'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMateriasSelector } from '@/features/materias/hooks/use-materias-selector'

// Radix no admite value="": un valor especial representa "todas las materias" (sin filtrar).
const TODAS_LAS_MATERIAS = '__TODAS__'

type FiltroMateriaProfesoresProps = {
  value: number | null
  onChange: (value: number | null) => void
}

export function FiltroMateriaProfesores({ value, onChange }: FiltroMateriaProfesoresProps) {
  const { data: materias, isLoading, isError } = useMateriasSelector()

  return (
    <Select
      value={value == null ? TODAS_LAS_MATERIAS : String(value)}
      onValueChange={(v) => onChange(v === TODAS_LAS_MATERIAS ? null : Number(v))}
      disabled={isLoading || isError || !materias?.length}
    >
      <SelectTrigger aria-label="Filtrar por materia" className="w-full sm:w-48">
        <SelectValue placeholder="Materia" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS_LAS_MATERIAS}>Todas las materias</SelectItem>
        {materias?.map((materia) => (
          <SelectItem key={materia.id} value={String(materia.id)}>
            {materia.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
