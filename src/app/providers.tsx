'use client'

import { useState } from 'react'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ToastProvider } from '@/components/ui/toast'
import { authClient } from '@/features/auth/auth-client'
import { USUARIO_INHABILITADO } from '@/features/auth/codigos-error'
import {
  MOTIVO_SESION_EXPIRADA,
  MOTIVO_USUARIO_INHABILITADO,
  urlDeLoginConMotivo,
  type MotivoDeSalida,
} from '@/features/auth/sesion-expirada'
import { ApiError } from '@/utils/fetch-json'

// Una página puede tener varias queries fallando a la vez; la salida se hace una sola vez.
let saliendo = false

// Recarga la página entera a propósito: así no sobrevive nada en memoria del usuario anterior.
function irALogin(motivo: MotivoDeSalida) {
  window.location.assign(urlDeLoginConMotivo(motivo))
}

async function cerrarSesionEIrALogin() {
  try {
    await authClient.signOut()
  } catch {
    // Si el signOut falla igual hay que sacarlo de la app: la sesión ya no sirve.
  }
  irALogin(MOTIVO_USUARIO_INHABILITADO)
}

/**
 * Saca al usuario de la app desde un solo lugar, venga el error de una query o de una mutation:
 * 401 (sesión vencida o inválida) y 403 USUARIO_INHABILITADO (lo dieron de baja con la sesión
 * abierta). Un 403 SIN_PERMISO no entra acá: lo muestra cada componente en el lugar del contenido.
 */
function manejarErrorDeSesion(error: unknown) {
  if (!(error instanceof ApiError) || saliendo) return
  if (window.location.pathname === '/login') return

  if (error.status === 401) {
    saliendo = true
    irALogin(MOTIVO_SESION_EXPIRADA)
    return
  }

  if (error.status === 403 && error.code === USUARIO_INHABILITADO) {
    saliendo = true
    // Sin cerrar la sesión, la cookie sigue viva y el proxy lo deja volver a entrar.
    void cerrarSesionEIrALogin()
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000 } },
        queryCache: new QueryCache({ onError: manejarErrorDeSesion }),
        mutationCache: new MutationCache({ onError: manejarErrorDeSesion }),
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
