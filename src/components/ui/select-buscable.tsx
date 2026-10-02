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
import { cn } from '@/utils/cn'

type Opcion = { id: number; nombre: string }

type SelectBuscableProps = {
  /** Las opciones, ya cargadas: el buscador las filtra en el cliente. */
  opciones: readonly Opcion[]
  /** La opción elegida; `null` = sin filtro. Se muestra aunque no esté entre `opciones`. */
  value: Opcion | null
  onChange: (opcion: Opcion | null) => void
  /** La opción que quita el filtro y el texto del botón sin nada elegido ("Todas las materias"). */
  textoTodas: string
  /** Para el buscador del menú y el lector de pantalla ("Buscar materia"). */
  etiquetaBusqueda: string
  textoVacio: string
  'aria-label': string
  className?: string
}

/** Sin tildes ni mayúsculas, para que "nunez" encuentre a "Núñez". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Un selector con buscador para elegir una opción de una lista que ya está en el cliente: se abre,
 * se escribe para acotar (todas las palabras, en cualquier orden, sin tildes) y se elige. Es la
 * versión local de `FiltroProfesorAgenda`, que le pide al backend los que coinciden.
 */
export function SelectBuscable({
  opciones,
  value,
  onChange,
  textoTodas,
  etiquetaBusqueda,
  textoVacio,
  'aria-label': ariaLabel,
  className,
}: SelectBuscableProps) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const terminos = normalizar(texto).split(/\s+/).filter(Boolean)
  const visibles = opciones.filter((opcion) => {
    const nombre = normalizar(opcion.nombre)
    return terminos.every((termino) => nombre.includes(termino))
  })

  // DropdownMenu enfoca su primer ítem al abrir: se le gana el foco al buscador un frame después.
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

  const elegir = (opcion: Opcion | null) => {
    onChange(opcion)
    cambiarAbierto(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={cambiarAbierto}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">{value ? value.nombre : textoTodas}</span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2" align="start">
        <SearchInput
          ref={inputRef}
          value={texto}
          onValueChange={setTexto}
          placeholder={`${etiquetaBusqueda}…`}
          aria-label={etiquetaBusqueda}
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
            <Check className={cn('size-4', value !== null && 'opacity-0')} />
            {textoTodas}
          </DropdownMenuItem>
          {visibles.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">{textoVacio}</p>
          ) : (
            visibles.map((opcion) => (
              <DropdownMenuItem key={opcion.id} onSelect={() => elegir(opcion)}>
                <Check className={cn('size-4 shrink-0', value?.id !== opcion.id && 'opacity-0')} />
                <span className="truncate">{opcion.nombre}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
