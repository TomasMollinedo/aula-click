'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { ChevronsUpDown } from 'lucide-react'

import { claseControlFiltro } from '@/components/ui/barra-filtros'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/utils/cn'

/** Las opciones del menú: `menuitem` (elegir una) o `menuitemcheckbox` (tildar varias). */
const OPCION = '[role="menuitem"], [role="menuitemcheckbox"]'

type MenuConBuscadorProps = {
  /** El `id` del botón, para el `htmlFor` del `Field` que lo rotula. */
  id: string
  abierto: boolean
  onAbiertoChange: (abierto: boolean) => void
  /** Lo escrito en el buscador. */
  texto: string
  onTextoChange: (texto: string) => void
  placeholderBusqueda: string
  /** Lo que dice el botón: lo elegido, o "Todos…" sin nada. */
  textoBoton: string
  /** Sin nada elegido: el botón va con el estilo de un filtro vacío (`claseControlFiltro`). */
  sinValor: boolean
  /**
   * Enter en el buscador. Devuelve `true` si lo usó (por ejemplo, para elegir el primer
   * resultado); si no, Enter no hace nada.
   */
  onEnterEnBuscador?: () => boolean
  disabled?: boolean
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  /** Las opciones (`DropdownMenuItem`), en la lista que scrollea debajo del buscador. */
  children: ReactNode
}

/**
 * Lo común de los selectores con buscador de una `BarraFiltros` (`ComboboxBuscador`, que elige una
 * opción, y los de selección múltiple, como el de materias de `cuentas`): un botón compacto con lo
 * elegido y un menú con un buscador arriba y las opciones debajo. No sabe qué se elige: las
 * opciones las pone quien lo usa, con su `onSelect`.
 *
 * Teclado: Enter o Espacio abren y el foco va al buscador; Flecha abajo pasa a la lista (flechas
 * para recorrerla) y Flecha arriba desde la primera opción vuelve al buscador; Escape cierra y
 * devuelve el foco al botón.
 */
export function MenuConBuscador({
  id,
  abierto,
  onAbiertoChange,
  texto,
  onTextoChange,
  placeholderBusqueda,
  textoBoton,
  sinValor,
  onEnterEnBuscador,
  disabled,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  children,
}: MenuConBuscadorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // DropdownMenu no expone `onOpenAutoFocus` (a diferencia de Popover/Dialog): enfoca el primer
  // ítem del menú por su cuenta. Se le gana el foco al buscador un frame después de abrir.
  useEffect(() => {
    if (!abierto) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [abierto])

  return (
    <DropdownMenu open={abierto} onOpenChange={onAbiertoChange}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          disabled={disabled}
          className={cn('aria-invalid:border-destructive', claseControlFiltro(sinValor), className)}
        >
          <span className="truncate">{textoBoton}</span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 p-2"
        align="start"
      >
        <SearchInput
          ref={inputRef}
          value={texto}
          onValueChange={onTextoChange}
          placeholder={placeholderBusqueda}
          aria-label={placeholderBusqueda}
          className="mb-2"
          onKeyDown={(e) => {
            // Radix solo se queda con Escape (cierra el menú): el resto de las teclas las
            // interceptaría para su typeahead, y sus flechas no salen de un campo de texto.
            if (e.key !== 'Escape') e.stopPropagation()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              listaRef.current?.querySelector<HTMLElement>(OPCION)?.focus()
            }
            if (e.key === 'Enter' && onEnterEnBuscador?.()) e.preventDefault()
          }}
        />
        <div
          ref={listaRef}
          className="max-h-64 overflow-y-auto"
          onKeyDown={(e) => {
            // Desde la primera opción, Flecha arriba vuelve al buscador.
            if (e.key !== 'ArrowUp') return
            if (e.target !== listaRef.current?.querySelector(OPCION)) return
            e.preventDefault()
            e.stopPropagation()
            inputRef.current?.focus()
          }}
        >
          {children}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
