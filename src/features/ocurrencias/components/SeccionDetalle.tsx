import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

/** Una sección del detalle de un turno (el del personal y el del portal): título con ícono. */
export function SeccionDetalle({
  icon: Icon,
  titulo,
  className,
  children,
}: {
  icon: LucideIcon
  titulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-cobalto size-4" />
        {titulo}
      </h3>
      {children}
    </Card>
  )
}
