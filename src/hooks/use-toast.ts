import { createContext, useContext } from 'react'

// Notificaciones efímeras (toasts). El contexto y el hook viven acá, separados del provider y de la
// UI (`components/ui/toast.tsx`): así cualquier feature o componente puede mostrar un toast sin
// importar componentes, y el archivo del provider exporta solo componentes (Fast Refresh).
// docs/arquitectura-frontend.md → Notificaciones (toasts).

export type ToastTipo = 'success' | 'error' | 'warning' | 'info'

export type ToastOpciones = {
  /** Milisegundos visible. Por defecto depende del tipo; `Infinity` lo deja hasta que se cierre. */
  duracion?: number
}

export type ToastItem = {
  id: string
  tipo: ToastTipo
  mensaje: string
  duracion: number
  /** Está haciendo la animación de salida: ya no cuenta tiempo y se desmonta enseguida. */
  saliendo: boolean
}

/** Cada función devuelve el id del toast, por si hace falta cerrarlo antes con `cerrar(id)`. */
export type ToastApi = Record<ToastTipo, (mensaje: string, opciones?: ToastOpciones) => string> & {
  cerrar: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/**
 * Muestra un toast: `toast.success('Alumno creado')`. La referencia es estable entre renders: se
 * puede poner en las dependencias de un `useEffect` o un `useCallback`.
 *
 * Recibe solo texto: convertir un `ApiError` en un mensaje legible le toca a quien lo llama.
 */
export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast va dentro de <ToastProvider> (app/providers.tsx)')
  return context
}
