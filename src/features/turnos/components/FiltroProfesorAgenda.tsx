'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProfesores } from '@/features/profesores/hooks/use-profesores'

// Radix no admite value="": un valor especial representa "todos los profesores" (sin filtrar).
const TODOS_LOS_PROFESORES = '__TODOS__'

type FiltroProfesorAgendaProps = {
  value: number | null
  onChange: (value: number | null) => void
}

export function FiltroProfesorAgenda({ value, onChange }: FiltroProfesorAgendaProps) {
  const { data, isLoading, isError } = useProfesores({ estado: 'ACTIVO', pageSize: 100 })
  const profesores = data?.data ?? []

  return (
    <Select
      value={value == null ? TODOS_LOS_PROFESORES : String(value)}
      onValueChange={(v) => onChange(v === TODOS_LOS_PROFESORES ? null : Number(v))}
      disabled={isLoading || isError}
    >
      <SelectTrigger aria-label="Filtrar por profesor" className="w-full sm:w-56">
        <SelectValue placeholder="Profesor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS_LOS_PROFESORES}>Todos los profesores</SelectItem>
        {profesores.map((profesor) => (
          <SelectItem key={profesor.id} value={String(profesor.id)}>
            {profesor.apellido}, {profesor.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
