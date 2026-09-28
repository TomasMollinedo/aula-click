'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMisMaterias } from '@/features/profesores/hooks/use-mis-materias'

// Radix no admite value="": un valor especial representa "todas las materias" (sin filtrar).
const TODAS_LAS_MATERIAS = '__TODAS__'

type FiltroMateriaAlumnosProps = {
  value: number | null
  onChange: (value: number | null) => void
}

/**
 * Filtro por materia de "Mis alumnos": solo las materias del profesor de la sesión (no el
 * catálogo completo), por eso usa `useMisMaterias` de `features/profesores` en vez de
 * `useMateriasSelector` de `features/materias` (de otra feature solo se usan sus hooks).
 */
export function FiltroMateriaAlumnos({ value, onChange }: FiltroMateriaAlumnosProps) {
  const { data: materias, isLoading, isError } = useMisMaterias()

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
        <SelectItem value={TODAS_LAS_MATERIAS}>Todas mis materias</SelectItem>
        {materias?.map((materia) => (
          <SelectItem key={materia.id} value={String(materia.id)}>
            {materia.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
