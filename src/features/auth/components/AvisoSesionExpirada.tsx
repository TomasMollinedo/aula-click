'use client'

import { useSearchParams } from 'next/navigation'

import { MOTIVO_SESION_EXPIRADA } from '@/features/auth/sesion-expirada'

// Usa useSearchParams: quien lo monte tiene que envolverlo en <Suspense> o el build de producción
// falla (node_modules/next/dist/docs → useSearchParams).
export function AvisoSesionExpirada() {
  const motivo = useSearchParams().get('motivo')
  if (motivo !== MOTIVO_SESION_EXPIRADA) return null

  return (
    <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      Tu sesión expiró. Volvé a iniciar sesión.
    </p>
  )
}
