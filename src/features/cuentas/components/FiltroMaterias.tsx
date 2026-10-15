'use client'

import { type KeyboardEventHandler, type ReactNode, useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { claseControlFiltro } from '@/components/ui/barra-filtros'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/utils/cn'

import { useMateriasDeCuenta } from '../hooks/use-materias-de-cuenta'
import {
  alternarMateria,
  filtrarMaterias,
  opcionesDeMaterias,
  textoBotonMaterias,
} from '../materias-del-filtro'

type FiltroMateriasProps = {
  /** El `id` del botón, para el `htmlFor` del `Field` que lo rotula. */
  id: string
  /** Las materias elegidas; `[]` = todas. */
  value: readonly number[]
  /** Cada elegida con su nombre (`useNombresDeFiltros`): también las que no están en la lista. */
  elegidas: readonly { id: number; nombre: string | null }[]
  onChange: (materiaIds: number[]) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * El filtro de materias de `cuentas`, de selección múltiple (HU-25): para cobrar varias materias
 * completas se eligen todas acá. Un botón con lo elegido ("Todas", "Inglés y Matemática" o
 * "3 materias") y un menú con un buscador y una casilla por materia, también las dadas de baja
 * (`useMateriasDeCuenta`). Tildar o destildar se aplica enseguida y **no cierra el menú**, para
 * elegir varias seguidas; "Todas" saca el filtro.
 *
 * Teclado: Enter o Espacio abren y el foco va al buscador; Flecha abajo pasa a la lista (flechas
 * para recorrerla, Enter o Espacio tildan, Flecha arriba desde "Todas" vuelve al buscador); Escape
 * cierra y devuelve el foco al botón.
 */
export function FiltroMaterias({
  id,
  value,
  elegidas,
  onChange,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: FiltroMateriasProps) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const { materias, isLoading } = useMateriasDeCuenta()

  // DropdownMenu enfoca el primer ítem al abrir: se le gana el foco al buscador un frame después
  // (como `ComboboxBuscador`).
  useEffect(() => {
    if (!abierto) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [abierto])

  const opciones = filtrarMaterias(opcionesDeMaterias(materias, elegidas), texto)
  const sinFiltro = value.length === 0

  return (
    <DropdownMenu
      open={abierto}
      onOpenChange={(nuevo) => {
        setAbierto(nuevo)
        // Al cerrar, el próximo buscador arranca vacío.
        if (!nuevo) setTexto('')
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          disabled={isLoading}
          className={cn('aria-invalid:border-destructive', claseControlFiltro(sinFiltro))}
        >
          <span className="truncate">{textoBotonMaterias(elegidas)}</span>
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
          placeholder="Buscar materia…"
          aria-label="Buscar materia"
          className="mb-2"
          onKeyDown={(e) => {
            // Radix solo se queda con Escape: el resto de las teclas las tomaría su typeahead.
            if (e.key !== 'Escape') e.stopPropagation()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              listaRef.current?.querySelector<HTMLElement>('[role="menuitemcheckbox"]')?.focus()
            }
          }}
        />
        <div ref={listaRef} className="max-h-64 overflow-y-auto">
          <OpcionConCasilla
            marcada={sinFiltro}
            onAlternar={() => onChange([])}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                e.stopPropagation()
                inputRef.current?.focus()
              }
            }}
          >
            Todas
          </OpcionConCasilla>
          <DropdownMenuSeparator />
          {opciones.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">Sin materias con ese nombre</p>
          ) : (
            opciones.map((opcion) => (
              <OpcionConCasilla
                key={opcion.id}
                marcada={value.includes(opcion.id)}
                onAlternar={() => onChange(alternarMateria(value, opcion.id))}
              >
                <span className="min-w-0 flex-1 truncate">
                  {opcion.nombre ?? 'Materia no disponible'}
                  {opcion.inactiva && ' (dada de baja)'}
                </span>
              </OpcionConCasilla>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Una opción con casilla: tildarla no cierra el menú. */
function OpcionConCasilla({
  marcada,
  onAlternar,
  onKeyDown,
  children,
}: {
  marcada: boolean
  onAlternar: () => void
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
  children: ReactNode
}) {
  return (
    <DropdownMenuItem
      role="menuitemcheckbox"
      aria-checked={marcada}
      onSelect={(e) => {
        e.preventDefault()
        onAlternar()
      }}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden
        className={cn(
          'border-input flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
          marcada && 'border-primary bg-primary text-primary-foreground',
        )}
      >
        {marcada && <Check className="size-3.5" />}
      </span>
      {children}
    </DropdownMenuItem>
  )
}
