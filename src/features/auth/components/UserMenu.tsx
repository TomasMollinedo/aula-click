'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { authClient } from '@/features/auth/auth-client'

export function UserMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  if (!session) return null

  const nombre = [session.user.name, session.user.apellido].filter(Boolean).join(' ')

  const cerrarSesion = async () => {
    await authClient.signOut()
    // Sin esto, los datos del usuario anterior siguen en la cache si se vuelve con Atrás.
    queryClient.clear()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-700">{nombre}</span>
      <button
        type="button"
        onClick={cerrarSesion}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
