'use client'

import { SearchInput } from '@/components/ui/search-input'

type BuscadorProfesoresProps = {
  texto: string
  onChange: (texto: string) => void
  className?: string
}

export function BuscadorProfesores({ texto, onChange, className }: BuscadorProfesoresProps) {
  return (
    <SearchInput
      value={texto}
      onValueChange={onChange}
      placeholder="Buscar por DNI, nombre o apellido…"
      aria-label="Buscar profesores por DNI, nombre o apellido"
      className={className}
    />
  )
}
