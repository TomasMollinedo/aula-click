'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { tieneHistorialPropio } from './volver'

// Presentación de los documentos imprimibles (HU-11, HU-15): una tarjeta suave con el color de la
// marca en las etiquetas, más prolija que una lista plana. La usan las hojas de `app/mesa/.../
// imprimir` (turno, agenda y comprobante de pago); `components/` no importa `features/`, así que vive acá.

/**
 * "Volver" arriba de la hoja de impresión: cancelar o cerrar el diálogo del navegador deja a la
 * persona en esta misma página, sin ningún paso para salir. Las hojas se abren en una pestaña
 * nueva (`target="_blank"`), que no tiene historial: ahí "Volver" la cierra y, si el navegador no
 * la deja cerrar (la abrió la persona pegando la URL), va a `rutaRespaldo`. Con una pantalla
 * anterior de la app en la misma pestaña, vuelve a ella (`tieneHistorialPropio`).
 *
 * `children`: acciones propias de la hoja, a la derecha (el "Imprimir" del comprobante).
 * `data-no-imprimir`: no sale en el PDF (`src/app/impresion.css`).
 */
export function BotonVolverImprimir({
  rutaRespaldo = '/mesa',
  children,
}: {
  rutaRespaldo?: string
  children?: ReactNode
}) {
  const router = useRouter()

  function volver() {
    // Navigation API: no está en todos los navegadores ni en los tipos del DOM de este proyecto.
    const { navigation } = window as { navigation?: { currentEntry?: { index: number } | null } }
    const historial = { longitud: window.history.length, indice: navigation?.currentEntry?.index }
    if (tieneHistorialPropio(historial)) {
      router.back()
      return
    }
    window.close()
    if (!window.closed) router.replace(rutaRespaldo)
  }

  return (
    <div
      className="mx-auto mb-4 flex max-w-[190mm] items-center justify-between gap-2"
      data-no-imprimir
    >
      <button
        type="button"
        onClick={volver}
        className="border-border text-muted-foreground hover:bg-accent/10 hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium shadow-sm"
      >
        <ArrowLeft className="size-4" />
        Volver
      </button>
      {children}
    </div>
  )
}

export function SeccionImpresa({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-black/10 bg-black/1.5 p-6">{children}</div>
}

export function Campos({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-8 gap-y-5">{children}</dl>
}

/** Etiqueta y valor. Sin valor (`null` o `undefined`) muestra `—`. */
export function Campo({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-dorado text-[10px] font-bold tracking-widest uppercase">{label}</dt>
      <dd className="mt-1 text-[15px] text-black">{valor ?? '—'}</dd>
    </div>
  )
}
