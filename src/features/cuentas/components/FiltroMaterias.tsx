'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { useComboboxBuscador } from '@/components/ui/combobox-buscador'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { MenuConBuscador } from '@/components/ui/menu-con-buscador'
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
 * completas se eligen todas acá. Es un `MenuConBuscador` (el botón dice "Todas", "Inglés y
 * Matemática" o "3 materias") con una casilla por materia, también las dadas de baja
 * (`useMateriasDeCuenta`). Tildar o destildar se aplica enseguida y **no cierra el menú**, para
 * elegir varias seguidas; "Todas" saca el filtro. El teclado es el de `MenuConBuscador`, y Enter o
 * Espacio en una opción la tildan.
 */
export function FiltroMaterias({
  id,
  value,
  elegidas,
  onChange,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: FiltroMateriasProps) {
  // El estado del menú (abierto y lo escrito) es el de un combobox: al cerrar, el buscador se vacía.
  const { abierto, texto, setTexto, cambiarAbierto } = useComboboxBuscador()
  const { materias, isLoading } = useMateriasDeCuenta()

  const opciones = filtrarMaterias(opcionesDeMaterias(materias, elegidas), texto)
  const sinFiltro = value.length === 0

  return (
    <MenuConBuscador
      id={id}
      abierto={abierto}
      onAbiertoChange={cambiarAbierto}
      texto={texto}
      onTextoChange={setTexto}
      placeholderBusqueda="Buscar materia…"
      textoBoton={textoBotonMaterias(elegidas)}
      sinValor={sinFiltro}
      disabled={isLoading}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
    >
      <OpcionConCasilla marcada={sinFiltro} onAlternar={() => onChange([])}>
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
    </MenuConBuscador>
  )
}

/** Una opción con casilla: tildarla no cierra el menú. */
function OpcionConCasilla({
  marcada,
  onAlternar,
  children,
}: {
  marcada: boolean
  onAlternar: () => void
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
