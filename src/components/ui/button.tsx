import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/utils/cn'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // shadow-sm + ring: misma receta de "superficie elevada" que components/ui/card.tsx.
        default:
          'bg-primary text-primary-foreground shadow-sm ring-1 ring-black/5 hover:bg-primary/90 hover:shadow',
        outline: 'border border-input bg-background hover:bg-muted hover:border-oscuro/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm ring-1 ring-black/5 hover:bg-secondary/80',
        ghost: 'hover:bg-muted',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm ring-1 ring-black/5 hover:bg-destructive/90 hover:shadow',
        // Paleta de acciones (globals.css): guardar/confirmar y cancelar en formularios.
        confirmado:
          'bg-confirmado text-white shadow-sm ring-1 ring-black/5 hover:bg-confirmado/90 hover:shadow',
        cancelado:
          'bg-cancelado text-white shadow-sm ring-1 ring-black/5 hover:bg-cancelado/90 hover:shadow',
        // Dorado (acento): la acción de editar.
        accent:
          'bg-accent text-accent-foreground shadow-sm ring-1 ring-black/5 hover:bg-accent/85 hover:shadow',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-5 font-semibold',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
