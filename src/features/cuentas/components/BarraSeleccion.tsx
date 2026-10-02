'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Banknote, ListChecks, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

import { textoSinPrecio, textoTotalAPagar, textoTurnosSeleccionados } from '../formato-cuentas'
import type { ResumenSeleccion } from '../seleccion'

type AccionesDeLaBarra = {
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
}

type BarraSeleccionProps = AccionesDeLaBarra & {
  /**
   * Si la barra se muestra (en la vista global, solo con un alumno filtrado). Sin barra se
   * renderizan solo las listas.
   */
  mostrar?: boolean
  /** Las listas sobre las que se selecciona: van entre la barra y su copia flotante. */
  children: ReactNode
}

/**
 * El resumen de lo tildado y sus acciones, alrededor de las listas (`children`). Arriba de ellas,
 * siempre: sin selección dice "Ningún turno seleccionado" y los botones quedan deshabilitados; con
 * selección, el total a pagar va destacado (grande y en negrita), con la cantidad de turnos. El
 * total es la suma de los importes de la API (`resumenSeleccion`); el real sale de la respuesta
 * del pago. A la izquierda van "Seleccionar todos los adeudados" y "Quitar selección"; a la
 * derecha, el total a pagar al lado de "Registrar pago". La copia flotante usa el mismo orden.
 *
 * **Copia flotante.** Cuando al scrollear las listas la barra deja de verse y hay algo tildado, la
 * misma barra aparece flotando abajo, para registrar el pago sin volver al principio: una bolita
 * blanca, sin texto, baja por el costado derecho y al llegar se abre hacia la izquierda hasta formar
 * la barra entera, con su contenido apareciendo al final (`animate-bola-entra`,
 * `animate-barra-entra` y `animate-barra-contenido-entra`, en `globals.css`). Al volver a verse la
 * de arriba, hace el camino inverso (`…-sale`). Es `sticky` contra el
 * borde de abajo del área que scrollea (el `main` de `AppShell`), así que solo existe mientras la
 * tarjeta de las listas está a la vista; por eso ningún contenedor entre la barra y el `main` puede
 * tener `overflow` (la tarjeta redondea sus listas en un contenedor aparte). Mientras está oculta
 * es `inert`: no se puede enfocar ni la leen los lectores de pantalla.
 */
export function BarraSeleccion({ mostrar = true, children, ...acciones }: BarraSeleccionProps) {
  const barraRef = useRef<HTMLDivElement>(null)
  // Si la barra de arriba está a la vista. Arranca en `true`: la flotante nunca aparece de entrada.
  const [aLaVista, setALaVista] = useState(true)
  const [seMostro, setSeMostro] = useState(false)

  useEffect(() => {
    const barra = barraRef.current
    if (!barra) return
    // Con `root: null` también cuenta el recorte del `main`, que es el que scrollea.
    const observer = new IntersectionObserver(([entrada]) => {
      if (entrada) setALaVista(entrada.isIntersecting)
    })
    observer.observe(barra)
    return () => observer.disconnect()
  }, [mostrar])

  if (!mostrar) return children

  const flotante = !aLaVista && acciones.resumen.cantidad > 0
  // La salida solo se anima si la flotante llegó a mostrarse: de entrada está oculta, sin animación
  // (ajuste del estado durante el render, sin un efecto).
  if (flotante && !seMostro) setSeMostro(true)

  return (
    <>
      <div
        ref={barraRef}
        className="bg-canvas m-3 flex flex-col gap-3 rounded-xl px-4 py-3 ring-1 ring-black/10 lg:flex-row lg:items-center lg:justify-between"
      >
        <Contenido {...acciones} anunciar />
      </div>

      {children}

      {/* Lugar para la flotante al final de la tarjeta: sin esto taparía las últimas filas. */}
      {flotante && <div aria-hidden className="h-24 lg:h-20" />}
      {/*
        Sin alto, para no ocupar lugar en la tarjeta: la flotante se dibuja hacia arriba desde acá.
        `-bottom-1 lg:-bottom-5`: el padding del `main` de `AppShell` (`p-6 lg:p-10`) menos 20 px, que
        es lo que queda entre la barra y el borde de abajo.
      */}
      <div className="sticky -bottom-1 z-20 h-0 lg:-bottom-5">
        <div
          inert={!flotante}
          className={cn(
            'bg-canvas absolute inset-x-3 bottom-0 flex flex-col gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ring-black/10 lg:flex-row lg:items-center lg:justify-between',
            // `*:`: el contenido (el total y los botones) se anima aparte de la barra.
            flotante
              ? 'animate-barra-entra *:animate-barra-contenido-entra opacity-100'
              : cn(
                  'pointer-events-none opacity-0',
                  seMostro && 'animate-barra-sale *:animate-barra-contenido-sale',
                ),
          )}
        >
          <Contenido {...acciones} />
        </div>
        {/*
          La bolita que viaja por el costado: llega a la esquina de abajo a la derecha de la barra
          (los mismos 14 px y 18 px del recorte de `barra-entra`, más el margen de la barra).
        */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute right-[26px] bottom-[18px] size-7 rounded-full bg-white opacity-0 shadow-lg ring-1 ring-black/15',
            flotante ? 'animate-bola-entra' : seMostro && 'animate-bola-sale',
          )}
        />
      </div>
    </>
  )
}

/** Lo que muestran las dos barras: el resumen de lo tildado y los botones. */
function Contenido({
  resumen,
  onSeleccionarTodos,
  seleccionarTodosDeshabilitado = false,
  onQuitar,
  onRegistrar,
  enEspera = false,
  anunciar = false,
}: AccionesDeLaBarra & {
  /** Solo la barra de arriba anuncia los cambios: si no, un lector de pantalla los diría dos veces. */
  anunciar?: boolean
}) {
  const vacia = resumen.cantidad === 0
  const sinPrecio = textoSinPrecio(resumen)

  return (
    <>
      {/* A la izquierda, las acciones sobre la selección. */}
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
      </div>
      {/* A la derecha, lo que se va a cobrar pegado al botón que lo cobra. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        {/* Siempre montado: un aria-live que aparece junto con su contenido no se anuncia. */}
        <div
          aria-live={anunciar ? 'polite' : undefined}
          aria-atomic={anunciar}
          className="min-w-0 sm:text-right"
        >
          {vacia ? (
            <p className="text-sm font-medium">Ningún turno seleccionado</p>
          ) : (
            <>
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Total a pagar · {textoTurnosSeleccionados(resumen.cantidad)}
              </p>
              {/*
                Resaltado: letras blancas sobre el verde de los importes (`confirmado`), grande y en
                negrita. Es lo que se va a cobrar. Sin total (algún turno sin precio) va en el color
                de aviso, no en verde.
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
        <Button
          type="button"
          className="shrink-0"
          onClick={(e) => onRegistrar(e.currentTarget)}
          disabled={vacia || enEspera}
        >
          <Banknote />
          Registrar pago
        </Button>
      </div>
    </>
  )
}
