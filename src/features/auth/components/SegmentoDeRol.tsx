'use client'

import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { authClient } from '@/features/auth/auth-client'
import { segmentoDeRol } from '@/features/auth/roles'
import type { Role } from '@/types'

// Deja a cada usuario en el segmento de su rol: es navegación, no seguridad (el control real es el
// 403 de la API). Sin sesión no hace nada: de eso se ocupan el proxy y el manejo de 401.
export function SegmentoDeRol({ rol, children }: { rol: Role; children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const rolDeLaSesion = session?.user.role

  if (!isPending && rolDeLaSesion && rolDeLaSesion !== rol) {
    redirect(segmentoDeRol(rolDeLaSesion) ?? '/')
  }

  return children
}
