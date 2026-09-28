'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  type RestriccionFechas,
  esFechaHabilitada,
  inicioDeMes,
  primeraHabilitadaDelMes,
  semanasDelMes,
  siguienteHabilitada,
  sumarMeses,
} from '@/utils/calendario'
import { cn } from '@/utils/cn'

const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Cuántos días mueve cada tecla dentro de la grilla. */
const PASOS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

type CalendarioFechaProps = RestriccionFechas & {
  id: string
  /** Fecha elegida, `YYYY-MM-DD`, o `''` si no hay. */
  value: string
  onChange: (fecha: string) => void
  onBlur?: () => void
  /** El `ref` va al botón que abre el calendario (así `setFocus` de react-hook-form lo enfoca). */
  ref?: Ref<HTMLButtonElement>
  placeholder?: string
  /** Texto del botón que deja el campo vacío (por ejemplo, "Sin fecha de fin"). Sin él, no se ofrece. */
  textoVaciar?: string
  disabled?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Selector de fecha con una grilla mensual en la que solo se pueden elegir los días que permite
 * la restricción (`min` y/o un `diaSemana`): no se puede escribir un día inválido, a diferencia de
 * `<input type="date">`. Entrega y recibe `YYYY-MM-DD`. Es una ayuda: quien lo usa valida igual.
 * Teclado: flechas para moverse entre días elegibles, Enter para elegir, Escape para cerrar.
 */
function CalendarioFecha({
  id,
  value,
  onChange,
  onBlur,
  ref,
  min,
  diaSemana,
  placeholder = 'Elegí una fecha',
  textoVaciar,
  disabled = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: CalendarioFechaProps) {
  const restriccion: RestriccionFechas = { min, diaSemana }
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(() =>
    inicioDeMes(value || min || format(new Date(), 'yyyy-MM-dd')),
  )
  const [enfocada, setEnfocada] = useState<string | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const grilla = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement | null>(null)
  const idTitulo = useId()

  const abrir = () => {
    const base = value || min || format(new Date(), 'yyyy-MM-dd')
    const mesInicial = inicioDeMes(base)
    setMes(mesInicial)
    setEnfocada(
      value && esFechaHabilitada(value, restriccion)
        ? value
        : primeraHabilitadaDelMes(mesInicial, restriccion),
    )
    setAbierto(true)
  }

  const cerrar = (devolverFoco = true) => {
    setAbierto(false)
    onBlur?.()
    if (devolverFoco) disparador.current?.focus()
  }

  const elegir = (fecha: string) => {
    onChange(fecha)
    cerrar()
  }

  // Cerrar con un clic afuera (suscripción a un evento externo: el setState va en el callback).
  useEffect(() => {
    if (!abierto) return
    const alClicAfuera = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false)
        onBlur?.()
      }
    }
    document.addEventListener('mousedown', alClicAfuera)
    return () => document.removeEventListener('mousedown', alClicAfuera)
  }, [abierto, onBlur])

  // Llevar el foco del teclado al día enfocado (DOM, sin estado).
  useEffect(() => {
    if (!abierto || !enfocada) return
    grilla.current?.querySelector<HTMLButtonElement>(`[data-fecha="${enfocada}"]`)?.focus()
  }, [abierto, enfocada, mes])

  const cambiarMes = (meses: number) => {
    const nuevo = sumarMeses(mes, meses)
    setMes(nuevo)
    setEnfocada(primeraHabilitadaDelMes(nuevo, restriccion))
  }

  const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      cerrar()
      return
    }
    const paso = PASOS[evento.key]
    if (paso === undefined || !enfocada) return
    evento.preventDefault()
    const siguiente = siguienteHabilitada(enfocada, paso, restriccion)
    if (!siguiente) return
    setEnfocada(siguiente)
    if (inicioDeMes(siguiente) !== mes) setMes(inicioDeMes(siguiente))
  }

  const semanas = semanasDelMes(mes)
  const hayAnterior = min === undefined || sumarMeses(mes, -1) >= inicioDeMes(min)
  const textoValor = value ? format(parseISO(value), 'EEEE dd/MM/yyyy', { locale: es }) : null

  return (
    <div ref={contenedor} className="relative">
      <Button
        ref={(nodo: HTMLButtonElement | null) => {
          disparador.current = nodo
          if (typeof ref === 'function') ref(nodo)
          else if (ref) ref.current = nodo
        }}
        id={id}
        type="button"
        variant="outline"
        size="lg"
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        className={cn(
          'aria-invalid:border-destructive w-full justify-between font-normal',
          !textoValor && 'text-muted-foreground',
        )}
      >
        <span className="first-letter:uppercase">{textoValor ?? placeholder}</span>
        <CalendarDays className="text-muted-foreground" aria-hidden />
      </Button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={idTitulo}
          onKeyDown={alTeclear}
          className="bg-popover text-popover-foreground absolute top-full left-0 z-40 mt-2 w-72 rounded-xl p-3 shadow-lg ring-1 ring-black/10"
        >
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => cambiarMes(-1)}
              disabled={!hayAnterior}
              aria-label="Mes anterior"
            >
              <ChevronLeft />
            </Button>
            <p
              id={idTitulo}
              className="text-sm font-semibold first-letter:uppercase"
              aria-live="polite"
            >
              {format(parseISO(mes), 'MMMM yyyy', { locale: es })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => cambiarMes(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight />
            </Button>
          </div>

          <div ref={grilla} role="grid" aria-labelledby={idTitulo} className="space-y-1">
            <div role="row" className="grid grid-cols-7 gap-1">
              {DIAS.map((dia, i) => (
                <span
                  key={dia}
                  role="columnheader"
                  aria-label={NOMBRES_DIAS[i]}
                  className="text-muted-foreground py-1 text-center text-xs font-medium"
                >
                  {dia}
                </span>
              ))}
            </div>
            {semanas.map((semana, i) => (
              <div key={i} role="row" className="grid grid-cols-7 gap-1">
                {semana.map((fecha, j) => {
                  if (!fecha) return <span key={j} role="gridcell" />
                  const habilitada = esFechaHabilitada(fecha, restriccion)
                  const elegida = fecha === value
                  return (
                    <span key={fecha} role="gridcell" aria-selected={elegida}>
                      <button
                        type="button"
                        data-fecha={fecha}
                        disabled={!habilitada}
                        tabIndex={fecha === enfocada ? 0 : -1}
                        onClick={() => elegir(fecha)}
                        aria-label={format(parseISO(fecha), "EEEE d 'de' MMMM 'de' yyyy", {
                          locale: es,
                        })}
                        className={cn(
                          'focus-visible:ring-ring flex h-8 w-full items-center justify-center rounded-md text-sm tabular-nums outline-none focus-visible:ring-2',
                          habilitada
                            ? 'hover:bg-cobalto/10 font-medium'
                            : 'text-muted-foreground/50 cursor-not-allowed',
                          elegida && 'bg-cobalto hover:bg-cobalto text-white',
                        )}
                      >
                        {Number(fecha.slice(8, 10))}
                      </button>
                    </span>
                  )
                })}
              </div>
            ))}
          </div>

          {textoVaciar && (
            <div className="border-border mt-2 border-t pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => elegir('')}
              >
                {textoVaciar}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { CalendarioFecha }
