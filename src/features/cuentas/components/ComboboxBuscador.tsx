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
import { cn } from '@/utils/cn'

const DEBOUNCE_MS = 300

export type OpcionCombobox = {
  id: number
  etiqueta: string
  /** Texto secundario a la derecha (por ejemplo, el DNI). */
  detalle?: string
}

/**
 * El estado de un `ComboboxBuscador`: si está abierto y qué se escribió. Lo tiene quien lo usa,
 * porque con eso pide las opciones a su hook (`q` con debounce, y solo con el menú abierto).
 */
export function useComboboxBuscador() {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const q = useDebounce(texto, DEBOUNCE_MS)

  return {
    abierto,
    texto,
    setTexto,
    /** Lo escrito, con debounce: el `q` de la búsqueda. */
    q,
    // Al cerrar (se elija algo o no), el próximo buscador arranca vacío.
    cambiarAbierto: (nuevoAbierto: boolean) => {
      setAbierto(nuevoAbierto)
      if (!nuevoAbierto) setTexto('')
    },
  }
}

type ComboboxBuscadorProps = {
  id: string
  estado: ReturnType<typeof useComboboxBuscador>
  /** `null` = sin elegir ("Todos…"). */
  valor: number | null
  /** El nombre del elegido; `null` mientras se resuelve. */
  textoValor: string | null
  /** La opción que saca el filtro: "Todos los profesores". */
  textoTodos: string
  placeholderBusqueda: string
  textoSinResultados: string
  /** Las opciones de la búsqueda actual (pocas: la primera página de resultados). */
  opciones: readonly OpcionCombobox[]
  buscando: boolean
  /** Si la búsqueda falló, el mensaje que va en lugar de las opciones. */
  error?: string | null
  onElegir: (valor: number | null) => void
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Selector con buscador para filtrar por una entidad que no entra en una lista (alumnos,
 * profesores): un botón con lo elegido y un menú con el buscador y los resultados. Es solo la UI:
 * no pide nada; quien lo usa trae las opciones con el hook de su feature.
 *
 * Teclado: Enter o Espacio abren y el foco va al buscador; se escribe; Enter elige el primer
 * resultado, o Flecha abajo pasa a la lista (flechas para recorrerla, Enter elige, y Flecha arriba
 * desde la primera opción vuelve al buscador); Escape cierra y devuelve el foco al botón.
 */
export function ComboboxBuscador({
  id,
  estado,
  valor,
  textoValor,
  textoTodos,
  placeholderBusqueda,
  textoSinResultados,
  opciones,
  buscando,
  error,
  onElegir,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: ComboboxBuscadorProps) {
  const { abierto, texto, q, setTexto, cambiarAbierto } = estado
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // DropdownMenu no expone `onOpenAutoFocus` (a diferencia de Popover/Dialog): enfoca el primer
  // ítem del menú por su cuenta. Se le gana el foco al buscador un frame después de abrir.
  useEffect(() => {
    if (!abierto) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [abierto])

  const elegir = (nuevo: number | null) => {
    onElegir(nuevo)
    cambiarAbierto(false)
  }

  return (
    <DropdownMenu open={abierto} onOpenChange={cambiarAbierto}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          className={cn(
            'aria-invalid:border-destructive w-full justify-between rounded-lg px-3 font-normal',
            valor === null && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{valor === null ? textoTodos : (textoValor ?? '…')}</span>
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
          onValueChange={setTexto}
          placeholder={placeholderBusqueda}
          aria-label={placeholderBusqueda}
          className="mb-2"
          onKeyDown={(e) => {
            // Radix solo se queda con Escape (cierra el menú): el resto de las teclas las
            // interceptaría para su typeahead, y sus flechas no salen de un campo de texto.
            if (e.key !== 'Escape') e.stopPropagation()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              listaRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
            }
            // Enter elige el primer resultado, si la lista ya es la de lo escrito.
            const primera = opciones[0]
            if (e.key === 'Enter' && primera && !buscando && !error && texto === q) {
              e.preventDefault()
              elegir(primera.id)
            }
          }}
        />
        <div ref={listaRef} className="max-h-64 overflow-y-auto">
          <DropdownMenuItem
            onSelect={() => elegir(null)}
            onKeyDown={(e) => {
              // Desde la primera opción, Flecha arriba vuelve al buscador.
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                e.stopPropagation()
                inputRef.current?.focus()
              }
            }}
          >
            <Check className={cn('size-4', valor !== null && 'opacity-0')} />
            {textoTodos}
          </DropdownMenuItem>
          {error ? (
            <p className="text-destructive px-2 py-3 text-sm">{error}</p>
          ) : buscando ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">Buscando…</p>
          ) : opciones.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">{textoSinResultados}</p>
          ) : (
            opciones.map((opcion) => (
              <DropdownMenuItem key={opcion.id} onSelect={() => elegir(opcion.id)}>
                <Check className={cn('size-4', valor !== opcion.id && 'opacity-0')} />
                <span className="min-w-0 flex-1 truncate">{opcion.etiqueta}</span>
                {opcion.detalle && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {opcion.detalle}
                  </span>
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
