import { Banknote, ListChecks, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

import { textoSinPrecio, textoTotalAPagar, textoTurnosSeleccionados } from '../formato-cuentas'
import type { ResumenSeleccion } from '../seleccion'

type BarraSeleccionProps = {
  resumen: ResumenSeleccion
  /**
   * "Seleccionar todos los adeudados": en la ficha y, con un alumno filtrado, en la vista global.
   * Solo si la sección de adeudados aplica al período: sin esta prop, el botón no está.
   */
  onSeleccionarTodos?: () => void
  seleccionarTodosDeshabilitado?: boolean
  onQuitar: () => void
  /** Abre el diálogo con la selección; recibe el botón para devolverle el foco al cerrar. */
  onRegistrar: (boton: HTMLButtonElement) => void
  /**
   * Lo que se ve es de un filtro anterior (`isPlaceholderData`): no se puede tildar ni cobrar
   * hasta que lleguen los datos del filtro actual.
   */
  enEspera?: boolean
  className?: string
}

/**
 * El resumen de lo tildado y sus acciones. Siempre visible junto a las listas: sin selección dice
 * "Ningún turno seleccionado" y los botones quedan deshabilitados. Con selección, el total a
 * pagar va destacado (grande y en negrita), con la cantidad de turnos arriba. El total es la suma
 * de los importes de la API (`resumenSeleccion`); el real sale de la respuesta del pago.
 *
 * Queda fija arriba al scrollear las listas (`sticky`), para registrar el pago de lo tildado sin
 * volver al principio. Se pega al borde del área que scrollea (el `main` de `AppShell`) y solo
 * mientras su tarjeta está a la vista; por eso ningún contenedor entre la barra y el `main` puede
 * tener `overflow` (la tarjeta redondea sus listas en un contenedor aparte).
 */
export function BarraSeleccion({
  resumen,
  onSeleccionarTodos,
  seleccionarTodosDeshabilitado = false,
  onQuitar,
  onRegistrar,
  enEspera = false,
  className,
}: BarraSeleccionProps) {
  const vacia = resumen.cantidad === 0
  const sinPrecio = textoSinPrecio(resumen)

  return (
    <div
      className={cn(
        // `-top-6 lg:-top-10`: lo que mide el padding del `main` de `AppShell` (`p-6 lg:p-10`), para
        // que se pegue al borde de arriba y no queden filas a la vista por encima de la barra.
        'bg-canvas sticky -top-6 z-20 flex flex-col gap-3 rounded-t-2xl shadow-sm lg:-top-10 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      {/* Siempre montado: un aria-live que aparece junto con su contenido no se anuncia. */}
      <div aria-live="polite" aria-atomic className="min-w-0">
        {vacia ? (
          <p className="text-sm font-medium">Ningún turno seleccionado</p>
        ) : (
          <>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Total a pagar · {textoTurnosSeleccionados(resumen.cantidad)}
            </p>
            {/*
              Resaltado: letras blancas sobre el verde de los importes (`confirmado`), grande y en
              negrita. Es lo que se va a cobrar, y tiene que leerse con la barra fija. Sin total
              (algún turno sin precio) va en el color de aviso, no en verde.
            */}
            <p
              className={cn(
                'mt-1 inline-block rounded-md px-2.5 py-0.5 text-2xl leading-tight font-bold text-white tabular-nums',
                resumen.total === null ? 'bg-urgente' : 'bg-confirmado',
              )}
            >
              {textoTotalAPagar(resumen)}
            </p>
            {sinPrecio && <p className="text-urgente text-xs font-medium">{sinPrecio}</p>}
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onSeleccionarTodos && (
          <Button
            type="button"
            variant="outline"
            onClick={onSeleccionarTodos}
            disabled={seleccionarTodosDeshabilitado || enEspera}
          >
            <ListChecks />
            Seleccionar todos los adeudados
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onQuitar} disabled={vacia || enEspera}>
          <X />
          Quitar selección
        </Button>
        <Button
          type="button"
          onClick={(e) => onRegistrar(e.currentTarget)}
          disabled={vacia || enEspera}
        >
          <Banknote />
          Registrar pago
        </Button>
      </div>
    </div>
  )
}
