'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LogOut, MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/features/auth/auth-client'
import { rolLabel } from '@/features/auth/roles'

export function UserMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  if (!session) return null

  const nombre = [session.user.name, session.user.apellido].filter(Boolean).join(' ')
  const iniciales = [session.user.name, session.user.apellido]
    .filter(Boolean)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()

  const cerrarSesion = async () => {
    await authClient.signOut()
    // Sin esto, los datos del usuario anterior siguen en la cache si se vuelve con Atrás.
    queryClient.clear()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        <AvatarFallback className="bg-cobalto/20 text-luminoso text-xs">{iniciales}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-luminoso truncate text-sm font-medium">{nombre}</p>
        <p className="text-luminoso/60 truncate text-xs">{rolLabel(session.user.role)}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Más opciones"
            className="text-luminoso/70 hover:text-luminoso size-7 shrink-0 hover:bg-white/10"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onSelect={cerrarSesion}>
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
