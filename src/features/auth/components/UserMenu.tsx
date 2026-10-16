'use client'

import { useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, MoreHorizontal, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/features/auth/auth-client'
import { rolLabel } from '@/features/auth/roles'
import { useMiPerfil } from '@/features/alumnos/hooks/use-mi-perfil'
import { getInitials } from '@/utils/initials'

/** Sin suscripción: el valor sólo cambia entre el servidor y el cliente, no con el tiempo. */
const suscribirNada = () => () => {}

export function UserMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  // El servidor no tiene sesión y no dibuja nada; si el primer render del navegador ya la tuviera
  // (viene de la cache del cliente), el HTML no coincidiría y React avisa (hydration mismatch). Se
  // dibuja recién ya hidratado: `false` en el servidor y en la hidratación, `true` después.
  const hidratado = useSyncExternalStore(
    suscribirNada,
    () => true,
    () => false,
  )
  // El alumno ve su nombre y su foto (o un avatar genérico) de `GET /alumnos/mi-perfil` (HU-28);
  // los demás roles, como siempre: el nombre de la sesión y sus iniciales.
  const esAlumno = session?.user.role === 'ALUMNO'
  const { data: perfil } = useMiPerfil({ habilitado: esAlumno })

  if (!hidratado || !session) return null

  const nombre =
    esAlumno && perfil
      ? `${perfil.nombre} ${perfil.apellido}`
      : [session.user.name, session.user.apellido].filter(Boolean).join(' ')
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
            {esAlumno && perfil?.fotoUrl && <AvatarImage src={perfil.fotoUrl} alt="" />}
            <AvatarFallback className="bg-luminoso text-cobalto text-xs font-semibold">
              {esAlumno ? <UserRound aria-hidden className="size-4" /> : iniciales}
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
