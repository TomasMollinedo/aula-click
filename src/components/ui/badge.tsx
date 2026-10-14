import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-input text-foreground',
        accent: 'border-transparent bg-accent font-semibold text-accent-foreground',
        confirmado: 'border-transparent bg-confirmado text-white',
        cancelado: 'border-transparent bg-cancelado text-white',
        urgente: 'border-transparent bg-urgente text-white',
        pendiente: 'border-transparent bg-pendiente text-white',
        // Estado del turno (components/turno/): badge suave, con borde.
        estadoAgendado:
          'border-estado-agendado-borde bg-estado-agendado-borde/25 text-estado-agendado',
        estadoRealizado:
          'border-estado-realizado-borde bg-estado-realizado-borde/25 text-estado-realizado',
        estadoAusente: 'border-estado-ausente-borde bg-estado-ausente-borde/25 text-estado-ausente',
        estadoCancelado:
          'border-estado-cancelado-borde bg-estado-cancelado-borde/25 text-cancelado',
        estadoSinRegistrar:
          'border-estado-sin-registrar-borde bg-estado-sin-registrar-borde/25 text-estado-sin-registrar',
        // "Sin registrar" con plazo: punteado, sin relleno dentro del plazo y con relleno si lo cerró el sistema.
        estadoPorVencer:
          'border-dashed border-estado-por-vencer-borde bg-transparent text-estado-por-vencer',
        estadoCerrado:
          'border-dashed border-estado-sin-registrar-borde bg-estado-sin-registrar-borde/25 text-estado-sin-registrar',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
}

export { Badge, badgeVariants }
