import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

/** Estado vacío (sin resultados, sin datos todavía): ícono, título, descripción y una acción. */
function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
  /** Acción opcional, por ejemplo un `Button`. */
  children?: ReactNode
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      {Icon && (
        <span className="bg-canvas mb-5 flex size-16 items-center justify-center rounded-full">
          <Icon className="text-cobalto size-6" />
        </span>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 text-sm">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}

export { EmptyState }
