'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LogOut, MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/features/auth/auth-client'
import { rolLabel } from '@/features/auth/roles'
import { getInitials } from '@/utils/initials'

export function UserMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  if (!session) return null

  const nombre = [session.user.name, session.user.apellido].filter(Boolean).join(' ')
  const iniciales = getInitials(session.user.name, session.user.apellido)

  const cerrarSesion = async () => {
    await authClient.signOut()
    // Sin esto, los datos del usuario anterior siguen en la cache si se vuelve con Atrás.
    queryClient.clear()
    router.replace('/login')
    router.refresh()
  }

  return (
    // Toda la fila es el disparador: con el Sidebar en modo "solo íconos" queda solo el avatar y
    // el menú sigue accesible. Los textos y el "⋯" aparecen con el Sidebar expandido (variante
    // `sidebar-abierto` del AppShell).
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menú de usuario"
          className="flex w-full items-center gap-2 rounded-lg text-left transition-colors hover:bg-white/10"
        >
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-luminoso text-cobalto text-xs font-semibold">
              {iniciales}
            </AvatarFallback>
          </Avatar>
          <div className="sidebar-abierto:opacity-100 min-w-0 flex-1 opacity-0 transition-opacity duration-300">
            <p className="text-luminoso truncate text-sm font-medium">{nombre}</p>
            <p className="text-luminoso/60 truncate text-xs">{rolLabel(session.user.role)}</p>
          </div>
          <MoreHorizontal className="text-luminoso/70 sidebar-abierto:opacity-100 mr-2 size-4 shrink-0 opacity-0 transition-opacity duration-300" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onSelect={cerrarSesion}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
