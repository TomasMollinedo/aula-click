import { Banknote, ListChecks, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

import { textoSeleccion } from '../formato-cuentas'
import type { ResumenSeleccion } from '../seleccion'

type BarraSeleccionProps = {
  resumen: ResumenSeleccion
  /** "Seleccionar todos los adeudados" (solo en la ficha). */
  onSeleccionarTodos?: () => void
  seleccionarTodosDeshabilitado?: boolean
  onQuitar: () => void
  /** Abre el diálogo con la selección; recibe el botón para devolverle el foco al cerrar. */
  onRegistrar: (boton: HTMLButtonElement) => void
  className?: string
}

/**
 * El resumen de lo tildado y sus acciones. Siempre visible junto a las listas: sin selección dice
 * "Ningún turno seleccionado" y los botones quedan deshabilitados. El total es la suma de los
 * importes de la API (`resumenSeleccion`); el real sale de la respuesta del pago.
 */
export function BarraSeleccion({
  resumen,
  onSeleccionarTodos,
  seleccionarTodosDeshabilitado = false,
  onQuitar,
  onRegistrar,
  className,
}: BarraSeleccionProps) {
  const vacia = resumen.cantidad === 0

  return (
    <div
      className={cn(
        'bg-canvas flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <p className="text-sm font-medium tabular-nums" aria-live="polite">
        {vacia ? 'Ningún turno seleccionado' : textoSeleccion(resumen)}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onSeleccionarTodos && (
          <Button
            type="button"
            variant="outline"
            onClick={onSeleccionarTodos}
            disabled={seleccionarTodosDeshabilitado}
          >
            <ListChecks />
            Seleccionar todos los adeudados
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onQuitar} disabled={vacia}>
          <X />
          Quitar selección
        </Button>
        <Button type="button" onClick={(e) => onRegistrar(e.currentTarget)} disabled={vacia}>
          <Banknote />
          Registrar pago
        </Button>
      </div>
    </div>
  )
}
