'use client'

import { useState } from 'react'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { URL_LOGIN_SESION_EXPIRADA } from '@/features/auth/sesion-expirada'
import { ApiError } from '@/utils/fetch-json'

// Un 401 manda a /login desde un solo lugar, venga de una query o de una mutation. Recarga la
// página entera a propósito: así no sobrevive nada en memoria del usuario anterior.
function redirigirSiLaSesionExpiro(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return
  if (window.location.pathname === '/login') return

  window.location.assign(URL_LOGIN_SESION_EXPIRADA)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000 } },
        queryCache: new QueryCache({ onError: redirigirSiLaSesionExpiro }),
        mutationCache: new MutationCache({ onError: redirigirSiLaSesionExpiro }),
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
