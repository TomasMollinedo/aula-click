'use client'

import { SearchInput } from '@/components/ui/search-input'

type BuscadorMateriasProps = {
  texto: string
  onChange: (texto: string) => void
  className?: string
}

export function BuscadorMaterias({ texto, onChange, className }: BuscadorMateriasProps) {
  return (
    <SearchInput
      value={texto}
      onValueChange={onChange}
      placeholder="Buscar por nombre…"
      aria-label="Buscar materias por nombre"
      className={className}
    />
  )
}
