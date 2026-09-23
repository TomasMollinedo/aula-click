'use client'

import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { authClient } from '@/features/auth/auth-client'
import { segmentoDeRol } from '@/features/auth/roles'
import type { Role } from '@/types'

// Deja a cada usuario en el segmento de su rol.
// Es navegación, no seguridad.
// El control real sigue estando en la API.
export function SegmentoDeRol({ rol, children }: { rol: Role; children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  const rolDeLaSesion = session?.user.role

  if (!isPending && rolDeLaSesion && rolDeLaSesion !== rol) {
    redirect(segmentoDeRol(rolDeLaSesion) ?? '/')
  }

  return children
}
