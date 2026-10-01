import { FilterX } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

type LimpiarFiltrosProps = Omit<ComponentProps<typeof Button>, 'variant' | 'type' | 'disabled'> & {
  /** Si hay algún filtro puesto. Sin filtros, el botón queda deshabilitado y sin color. */
  hayFiltros: boolean
}

/**
 * El botón "Limpiar filtros" de cualquier pantalla con filtros: el mismo en todas. Con filtros
 * puestos va en rojo y con el contorno marcado, para que se distinga de los controles que lo
 * rodean; sin filtros queda deshabilitado. Tiene la altura de un control compacto (`h-9`), para
 * ir en la misma fila que los filtros. Qué es "limpiar" (qué parámetros se sacan) lo decide quien
 * lo usa, en `onClick`.
 */
function LimpiarFiltros({
  hayFiltros,
  className,
  children = 'Limpiar filtros',
  ...props
}: LimpiarFiltrosProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={!hayFiltros}
      data-slot="limpiar-filtros"
      // `border-2` también deshabilitado: el botón no cambia de tamaño al poner un filtro.
      className={cn(
        'rounded-lg border-2 px-3',
        hayFiltros &&
          'border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive/5',
        className,
      )}
      {...props}
    >
      <FilterX />
      {children}
    </Button>
  )
}

export { LimpiarFiltros }
