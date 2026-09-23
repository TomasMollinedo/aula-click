'use client'

import { useSearchParams } from 'next/navigation'

import { avisoDeMotivo } from '@/features/auth/sesion-expirada'

// Usa useSearchParams: quien lo monte tiene que envolverlo en <Suspense>
// o el build de producción falla.
export function AvisoSesionExpirada() {
  const aviso = avisoDeMotivo(useSearchParams().get('motivo'))

  if (!aviso) return null

  return (
    <p role="status" className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      {aviso}
    </p>
  )
}
