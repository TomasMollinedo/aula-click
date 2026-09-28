'use client'

import { SearchInput } from '@/components/ui/search-input'

type BuscadorAlumnosProps = {
  texto: string
  onChange: (texto: string) => void
  className?: string
}

export function BuscadorAlumnos({ texto, onChange, className }: BuscadorAlumnosProps) {
  return (
    <SearchInput
      value={texto}
      onValueChange={onChange}
      placeholder="Buscar por DNI, nombre o apellido…"
      aria-label="Buscar alumnos por DNI, nombre o apellido"
      className={className}
    />
  )
}
