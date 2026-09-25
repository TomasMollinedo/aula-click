'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchInput } from '@/components/ui/search-input'
import { useDebounce } from '@/hooks/use-debounce'
import { useProfesor } from '@/features/profesores/hooks/use-profesor'
import { useProfesores } from '@/features/profesores/hooks/use-profesores'
import { cn } from '@/utils/cn'

const DEBOUNCE_MS = 300

type FiltroProfesorAgendaProps = {
  value: number | null
  onChange: (value: number | null) => void
}

// Buscador con debounce en vez de traer y listar todos los profesores: cada tecla pide al
// backend solo los que coinciden (hasta 10), como el resto de los buscadores de la app.
export function FiltroProfesorAgenda({ value, onChange }: FiltroProfesorAgendaProps) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState('')
  const busqueda = useDebounce(texto, DEBOUNCE_MS)
  const inputRef = useRef<HTMLInputElement>(null)

  // El nombre del elegido se resuelve aparte de la búsqueda: puede no estar en la página actual
  // de resultados (o el filtro venir de la URL al entrar).
  const { data: seleccionado } = useProfesor(value ?? 0)
  const { data, isFetching } = useProfesores(
    { estado: 'ACTIVO', q: busqueda || undefined, pageSize: 10 },
    open,
  )
  const profesores = data?.data ?? []

  // DropdownMenu no expone `onOpenAutoFocus` (a diferencia de Popover/Dialog): enfoca el primer
  // ítem del menú por su cuenta. Se le gana el foco al buscador un frame después de abrir.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const cambiarAbierto = (nuevoAbierto: boolean) => {
    setOpen(nuevoAbierto)
    // Al cerrar (se elija algo o no), el próximo buscador arranca vacío.
    if (!nuevoAbierto) setTexto('')
  }

  const elegir = (profesorId: number | null) => {
    onChange(profesorId)
    cambiarAbierto(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={cambiarAbierto}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filtrar por profesor"
          className="w-full justify-between font-normal sm:w-56"
        >
          <span className="truncate">
            {value == null
              ? 'Todos los profesores'
              : seleccionado && `${seleccionado.apellido}, ${seleccionado.nombre}`}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2" align="start">
        <SearchInput
          ref={inputRef}
          value={texto}
          onValueChange={setTexto}
          placeholder="Buscar profesor…"
          aria-label="Buscar profesor"
          className="mb-2"
          onKeyDown={(e) => {
            // Radix intercepta las teclas para su propio typeahead: se las quedan solo Escape
            // (cierra el menú) y las de navegar la lista de abajo con flechas.
            if (e.key !== 'Escape' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
              e.stopPropagation()
            }
          }}
        />
        <div className="max-h-64 overflow-y-auto">
          <DropdownMenuItem onSelect={() => elegir(null)}>
            <Check className={cn('size-4', value != null && 'opacity-0')} />
            Todos los profesores
          </DropdownMenuItem>
          {isFetching ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">Buscando…</p>
          ) : profesores.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">No se encontraron profesores.</p>
          ) : (
            profesores.map((profesor) => (
              <DropdownMenuItem key={profesor.id} onSelect={() => elegir(profesor.id)}>
                <Check className={cn('size-4', value !== profesor.id && 'opacity-0')} />
                {profesor.apellido}, {profesor.nombre}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
