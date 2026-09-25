import { type ChangeEvent, type ComponentProps, forwardRef } from 'react'

import { type TipoDeCaracteres, filtrarCaracteres } from '@/utils/caracteres'
import { cn } from '@/utils/cn'

const Input = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & {
    /**
     * Descarta, mientras se escribe o se pega, lo que el tipo no acepta (`utils/caracteres.ts`). Es
     * una ayuda: el schema del formulario y la API validan igual.
     */
    caracteres?: TipoDeCaracteres
  }
>(function Input({ className, type, caracteres, onChange, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-11 w-full min-w-0 rounded-lg border px-3.5 py-1 text-sm transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onChange={
        caracteres
          ? (e) => {
              filtrarInput(e, caracteres)
              onChange?.(e)
            }
          : onChange
      }
      {...props}
    />
  )
})

/**
 * Filtra el valor antes de que lo lea `onChange` (sirve igual con inputs controlados y con
 * `register` de react-hook-form) y deja el cursor donde estaba, no al final.
 */
function filtrarInput(e: ChangeEvent<HTMLInputElement>, tipo: TipoDeCaracteres) {
  // Durante una composición (IME, algunas teclas muertas) cambiar el valor la rompe: lo que quede
  // sin filtrar lo marca la validación.
  if ((e.nativeEvent as InputEvent).isComposing) return
  const input = e.currentTarget
  const filtrado = filtrarCaracteres(input.value, tipo)
  if (filtrado === input.value) return
  const cursor = filtrarCaracteres(input.value.slice(0, input.selectionStart ?? 0), tipo).length
  input.value = filtrado
  input.setSelectionRange(cursor, cursor)
}

export { Input }
