'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Presentación de los documentos imprimibles (HU-11, HU-15): una tarjeta suave con el color de la
// marca en las etiquetas, más prolija que una lista plana. La usan las hojas de `app/mesa/.../
// imprimir` (turno y agenda); `components/` no importa `features/`, así que vive acá.

/**
 * "Volver" arriba de la hoja de impresión: cancelar o cerrar el diálogo del navegador deja a la
 * persona en esta misma página, sin ningún paso para salir. `router.back()` porque se llega acá
 * con un `Link` (push), nunca por URL directa desde otra pantalla. `data-no-imprimir`: no sale en
 * el PDF (`src/app/impresion.css`).
 */
export function BotonVolverImprimir() {
  const router = useRouter()
  return (
    <div className="mx-auto mb-4 max-w-[190mm]" data-no-imprimir>
      <button
        type="button"
        onClick={() => router.back()}
        className="border-border text-muted-foreground hover:bg-accent/10 hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium shadow-sm"
      >
        <ArrowLeft className="size-4" />
        Volver
      </button>
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
      <dt className="text-cobalto text-[10px] font-bold tracking-widest uppercase">{label}</dt>
      <dd className="mt-1 text-[15px] text-black">{valor ?? '—'}</dd>
    </div>
  )
}
