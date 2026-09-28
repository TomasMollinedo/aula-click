'use client'

import { CircleCheck, CircleX, Info, type LucideIcon, TriangleAlert, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  type ToastApi,
  ToastContext,
  type ToastItem,
  type ToastOpciones,
  type ToastTipo,
} from '@/hooks/use-toast'
import { cn } from '@/utils/cn'

// Provider y UI de los toasts. Se monta una sola vez en `app/providers.tsx`; se usan con
// `useToast()` de `hooks/use-toast.ts` (docs/arquitectura-frontend.md → Notificaciones (toasts)).

/** Tiene que coincidir con la duración de `--animate-toast-out` en globals.css. */
const DURACION_SALIDA = 150
/** Los errores quedan más tiempo: suelen ser más largos y hay que poder leerlos. */
const DURACION_POR_TIPO: Record<ToastTipo, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
}
/** Con más en pantalla se descartan los más viejos, para que una ráfaga de errores no tape todo. */
const MAX_TOASTS = 5

const ESTILOS: Record<ToastTipo, { icono: LucideIcon; borde: string; color: string }> = {
  success: { icono: CircleCheck, borde: 'border-l-confirmado', color: 'text-confirmado' },
  error: { icono: CircleX, borde: 'border-l-cancelado', color: 'text-cancelado' },
  warning: { icono: TriangleAlert, borde: 'border-l-urgente', color: 'text-urgente' },
  info: { icono: Info, borde: 'border-l-cobalto', color: 'text-cobalto' },
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const siguienteId = useRef(0)
  // Toasts en animación de salida → timeout que los desmonta.
  const salidas = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Sale en dos fases: primero se marca `saliendo` (animación y fin del autocierre) y, terminada la
  // animación, se saca de la lista.
  const cerrar = useCallback((id: string) => {
    if (salidas.current.has(id)) return
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)))
    salidas.current.set(
      id,
      setTimeout(() => {
        salidas.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, DURACION_SALIDA),
    )
  }, [])

  useEffect(() => {
    const pendientes = salidas.current
    return () => {
      pendientes.forEach(clearTimeout)
      pendientes.clear()
    }
  }, [])

  // Estable: no cambia entre renders, así quien lo usa puede ponerlo en dependencias sin loops.
  const api = useMemo<ToastApi>(() => {
    const agregar = (tipo: ToastTipo) => (mensaje: string, opciones?: ToastOpciones) => {
      const id = `toast-${siguienteId.current++}`
      const duracion = opciones?.duracion ?? DURACION_POR_TIPO[tipo]
      setToasts((prev) =>
        [...prev, { id, tipo, mensaje, duracion, saliendo: false }].slice(-MAX_TOASTS),
      )
      return id
    }
    return {
      success: agregar('success'),
      error: agregar('error'),
      warning: agregar('warning'),
      info: agregar('info'),
      cerrar,
    }
  }, [cerrar])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Siempre montado: un aria-live que aparece junto con su contenido no se anuncia. Con
          aria-live, además, el Dialog de Radix no lo oculta (aria-hidden) cuando hay un modal
          abierto. z-60: por encima de Dialog y Panel (z-50). pointer-events-none: el hueco de la
          pila no bloquea clics sobre la página. */}
      <div
        data-slot="toast-viewport"
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={cerrar} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const { icono: Icono, borde, color } = ESTILOS[toast.tipo]
  // El autocierre se pausa con el mouse encima o el foco adentro, para que se pueda leer (WCAG 2.2.1).
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  const restante = useRef(toast.duracion)

  useEffect(() => {
    if (hover || foco || toast.saliendo || !Number.isFinite(restante.current)) return
    const inicio = Date.now()
    const timeout = setTimeout(() => onClose(toast.id), restante.current)
    return () => {
      clearTimeout(timeout)
      restante.current -= Date.now() - inicio
    }
  }, [hover, foco, toast.saliendo, toast.id, onClose])

  return (
    <div
      data-slot="toast"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFoco(false)
      }}
      className={cn(
        'bg-background text-foreground pointer-events-auto flex w-full items-start gap-3 rounded-xl border-l-4 py-3 pr-2 pl-4 text-sm shadow-lg ring-1 ring-black/5 motion-reduce:animate-none',
        toast.saliendo ? 'animate-toast-out' : 'animate-toast-in',
        borde,
      )}
    >
      <Icono aria-hidden className={cn('mt-0.5 size-5 shrink-0', color)} />
      <p className="flex-1 py-0.5 leading-snug">{toast.mensaje}</p>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-7 rounded-md"
        aria-label="Cerrar notificación"
        onClick={() => onClose(toast.id)}
      >
        <X />
      </Button>
    </div>
  )
}

export { ToastProvider }
