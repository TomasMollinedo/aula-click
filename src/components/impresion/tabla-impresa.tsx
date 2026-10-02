import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

// Tabla de un documento imprimible que puede ocupar varias hojas (el comprobante de pago: hasta
// 200 turnos). Mismo lenguaje que `Campo`: encabezados en cobalto y en mayúsculas, filas con un
// separador suave e importes a la derecha. `data-tabla-impresa` y `data-no-partir` son los ganchos
// de `src/app/impresion.css`: el encabezado se repite en cada hoja y ninguna fila se parte.

/** `titulo` es el `<caption>`, sólo para lectores de pantalla. */
export function TablaImpresa({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <table data-tabla-impresa className="w-full border-collapse text-sm">
      <caption className="sr-only">{titulo}</caption>
      {children}
    </table>
  )
}

export function EncabezadosImpresos({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-cobalto/40 border-b-2 text-left">{children}</tr>
    </thead>
  )
}

/** `numerica`: columna de importes, alineada a la derecha. */
export function EncabezadoImpreso({
  numerica = false,
  children,
}: {
  numerica?: boolean
  children: ReactNode
}) {
  return (
    <th
      scope="col"
      className={cn(
        'text-cobalto py-2 text-[11px] font-bold tracking-wide uppercase',
        numerica ? 'text-right' : 'pr-3',
      )}
    >
      {children}
    </th>
  )
}

export function FilaImpresa({ children }: { children: ReactNode }) {
  return <tr className="border-b border-black/10">{children}</tr>
}

export function CeldaImpresa({
  numerica = false,
  className,
  children,
}: {
  numerica?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <td className={cn('py-2', numerica ? 'text-right tabular-nums' : 'pr-3', className)}>
      {children}
    </td>
  )
}

/**
 * Lo que cierra el documento después de la tabla (totales y pie): al imprimir no se parte entre
 * dos hojas ni queda solo en la última, separado de la última fila.
 */
export function CierreImpreso({ children }: { children: ReactNode }) {
  return (
    <div data-no-partir className="space-y-5">
      {children}
    </div>
  )
}
