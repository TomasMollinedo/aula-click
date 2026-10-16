'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { TableHead } from '@/components/ui/table'
import { cn } from '@/utils/cn'

/** La dirección de un orden, la misma que mandan las APIs (`?direccion=`). */
export type SortDirection = 'asc' | 'desc'

/**
 * El encabezado de una columna que reordena una tabla. Genérico sobre el nombre de las columnas
 * (`T`, el conjunto de valores que acepta la API en `?orden=`), así que cada tabla pasa el suyo y
 * el compilador no deja ordenar por una columna que no existe.
 *
 * Accesibilidad: el `<th>` activo lleva `aria-sort` (`ascending` o `descending`) y el control es un
 * `<button>` con el **texto** de la columna, no sólo un ícono; el ícono es decorativo
 * (`aria-hidden`) y el estado se dice en palabras para el lector de pantalla. El que ordena la
 * tabla es el servidor: acá sólo se avisa qué columna se clickeó.
 */
export function SortableTableHead<T extends string>({
  columna,
  children,
  orden,
  direccion,
  onOrdenar,
  numerica = false,
}: {
  columna: T
  children: string
  /** La columna por la que está ordenada la tabla ahora. */
  orden: T
  direccion: SortDirection
  onOrdenar: (columna: T) => void
  /** Columna de números: se alinea a la derecha, como sus celdas. */
  numerica?: boolean
}) {
  const activa = orden === columna
  const Icono = !activa ? ChevronsUpDown : direccion === 'asc' ? ArrowUp : ArrowDown
  const comoOrdena = direccion === 'asc' ? 'de menor a mayor' : 'de mayor a menor'

  return (
    <TableHead
      aria-sort={activa ? (direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('p-0', numerica && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className={cn(
          'hover:text-foreground focus-visible:ring-ring/50 flex h-11 w-full items-center gap-1.5 px-6 text-left text-[11px] font-semibold tracking-wide uppercase outline-none focus-visible:ring-2',
          numerica && 'justify-end',
          activa && 'text-foreground',
        )}
      >
        <span>{children}</span>
        <Icono aria-hidden className="size-3.5 shrink-0 opacity-70" />
        <span className="sr-only">
          {activa
            ? `Ordenado ${comoOrdena}. Activar para invertir el orden.`
            : 'Activar para ordenar por esta columna.'}
        </span>
      </button>
    </TableHead>
  )
}
