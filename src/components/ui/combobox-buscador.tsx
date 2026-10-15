'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuConBuscador } from '@/components/ui/menu-con-buscador'
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
 * profesores): un botón con lo elegido y un menú con el buscador y los resultados
 * (`MenuConBuscador`). Es solo la UI: no pide nada; quien lo usa trae las opciones con el hook de
 * su feature (o, si ya las tiene todas, las filtra con `SelectBuscable`). El botón es el control
 * compacto de una `BarraFiltros`.
 *
 * Teclado: el de `MenuConBuscador`, y además Enter en el buscador elige el primer resultado y en
 * una opción la elige.
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

  const elegir = (nuevo: number | null) => {
    onElegir(nuevo)
    cambiarAbierto(false)
  }

  return (
    <MenuConBuscador
      id={id}
      abierto={abierto}
      onAbiertoChange={cambiarAbierto}
      texto={texto}
      onTextoChange={setTexto}
      placeholderBusqueda={placeholderBusqueda}
      textoBoton={valor === null ? textoTodos : (textoValor ?? '…')}
      sinValor={valor === null}
      // Enter elige el primer resultado, si la lista ya es la de lo escrito.
      onEnterEnBuscador={() => {
        const primera = opciones[0]
        if (!primera || buscando || error || texto !== q) return false
        elegir(primera.id)
        return true
      }}
      className={className}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
    >
      <DropdownMenuItem onSelect={() => elegir(null)}>
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
              <span className="text-muted-foreground text-xs tabular-nums">{opcion.detalle}</span>
            )}
          </DropdownMenuItem>
        ))
      )}
    </MenuConBuscador>
  )
}
