import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

/**
 * Lista de datos de solo lectura (`<dl>`) en dos columnas: la usan los detalles (página o modal).
 * Cada dato es un `Dato`.
 */
function Datos({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn('grid gap-x-8 gap-y-5 sm:grid-cols-2', className)}>{children}</dl>
}

/** Etiqueta y valor. Sin valor (`null` o `undefined`) muestra `—`. */
function Dato({
  label,
  valor,
  className,
}: {
  label: string
  valor: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words">{valor ?? '—'}</dd>
    </div>
  )
}

export { Datos, Dato }
