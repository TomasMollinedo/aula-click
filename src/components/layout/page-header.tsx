import type { ReactNode } from 'react'

// Encabezado de cada pantalla de la app autenticada: título, descripción y la acción principal
// (por ejemplo "Nuevo alumno") a la derecha.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-muted-foreground mt-2 text-sm">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
