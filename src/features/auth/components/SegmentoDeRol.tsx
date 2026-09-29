'use client'

import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { authClient } from '@/features/auth/auth-client'
import { segmentoDeRol } from '@/features/auth/roles'
import type { Role } from '@/types'

// Si el rol de la sesión no es el de este segmento, muestra un aviso con un enlace a la pantalla
// de inicio del propio rol en lugar del contenido (HU-21).
// Es navegación, no seguridad: el control real sigue estando en la API.
export function SegmentoDeRol({ rol, children }: { rol: Role; children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()

  const rolDeLaSesion = session?.user.role

  if (!isPending && rolDeLaSesion && rolDeLaSesion !== rol) {
    const inicio = segmentoDeRol(rolDeLaSesion)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState icon={ShieldAlert} title="No tiene permiso para acceder a esta sección">
          {inicio && (
            <Button asChild>
              <Link href={inicio}>Ir a mi pantalla de inicio</Link>
            </Button>
          )}
        </EmptyState>
      </div>
    )
  }

  return children
}
