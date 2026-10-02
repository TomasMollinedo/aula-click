import type { ReactNode } from 'react'

import { LimpiarFiltros } from '@/components/ui/limpiar-filtros'
import { cn } from '@/utils/cn'

// Desde qué ancho "Limpiar filtros" entra en la fila de los campos. El margen de arriba ocupa el
// lugar del label de un `Field` (14px del texto + 8px de separación), así queda a la altura de los
// controles aunque un campo crezca hacia abajo con su error.
const LIMPIAR_EN_FILA = {
  md: 'md:col-span-1 md:mt-[22px]',
  lg: 'lg:col-span-1 lg:mt-[22px]',
  xl: 'xl:col-span-1 xl:mt-[22px]',
  '2xl': '2xl:col-span-1 2xl:mt-[22px]',
}

type BarraFiltrosProps = {
  /** Los filtros: un `Field` (label arriba) por control, con controles compactos. */
  children: ReactNode
  /** Si hay algún filtro puesto: habilita "Limpiar filtros". */
  hayFiltros: boolean
  /** Qué es "limpiar" (qué filtros se sacan) lo decide quien la usa. */
  onLimpiar: () => void
  /**
   * El ancho desde el que los campos y "Limpiar filtros" entran en una sola fila. Antes, el botón
   * va en una fila propia, a la derecha.
   */
  limpiarEnFila: keyof typeof LIMPIAR_EN_FILA
  /**
   * Las columnas de la grilla en cada ancho (`sm:grid-cols-2 …`). Desde `limpiarEnFila`, una por
   * campo más la última para el botón (`auto`, o `1fr` si los campos no ocupan todo el ancho).
   */
  className?: string
}

/**
 * La fila de filtros de cualquier pantalla: la misma en todas. Cada filtro es un `Field` con su
 * label arriba y, al final, `LimpiarFiltros`, siempre visible (deshabilitado sin filtros). No guarda
 * estado ni conoce los filtros: solo los acomoda.
 */
function BarraFiltros({
  children,
  hayFiltros,
  onLimpiar,
  limpiarEnFila,
  className,
}: BarraFiltrosProps) {
  return (
    <section
      aria-label="Filtros"
      data-slot="barra-filtros"
      className={cn('grid items-start gap-3', className)}
    >
      {children}
      <div className={cn('col-span-full flex justify-end', LIMPIAR_EN_FILA[limpiarEnFila])}>
        <LimpiarFiltros hayFiltros={hayFiltros} onClick={onLimpiar} />
      </div>
    </section>
  )
}

/**
 * Las clases del control de un filtro que no es un input (el trigger de un `Select` o de un
 * selector con buscador): compacto, del ancho de su campo y, sin nada elegido (`sinFiltro`), con el
 * texto atenuado.
 */
function claseControlFiltro(sinFiltro: boolean) {
  return cn(
    'h-9 w-full justify-between rounded-lg px-3 font-normal [&>span]:truncate',
    sinFiltro && 'text-muted-foreground',
  )
}

export { BarraFiltros, claseControlFiltro }
