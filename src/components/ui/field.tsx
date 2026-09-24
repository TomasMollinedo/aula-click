import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'

/** `id` del mensaje de error de un campo, para el `aria-describedby` del control. */
function fieldErrorId(htmlFor: string) {
  return `${htmlFor}-error`
}

/**
 * Campo de formulario: label (con `*` si es obligatorio o "(opcional)"), el control que llega como
 * `children` y el mensaje de error. El control lleva `id={htmlFor}`, `aria-invalid` y
 * `aria-describedby={fieldErrorId(htmlFor)}`.
 */
function Field({
  label,
  htmlFor,
  required,
  optional,
  error,
  className,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  optional?: boolean
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div data-slot="field" className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor} className="gap-1 font-semibold">
        {label}
        {required && (
          <span aria-hidden className="text-muted-foreground font-normal">
            *
          </span>
        )}
        {optional && <span className="text-muted-foreground font-normal">(opcional)</span>}
      </Label>
      {children}
      {error && (
        <p id={fieldErrorId(htmlFor)} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export { Field, fieldErrorId }
