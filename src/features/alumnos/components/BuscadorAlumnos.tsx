'use client'

import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

type BuscadorAlumnosProps = {
  texto: string
  onChange: (texto: string) => void
}

export function BuscadorAlumnos({ texto, onChange }: BuscadorAlumnosProps) {
  return (
    <div className="relative max-w-sm">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        placeholder="Buscar por apellido, nombre o DNI"
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}
