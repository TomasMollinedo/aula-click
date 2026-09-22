'use client'

import { redirect } from 'next/navigation'

import { authClient } from '@/features/auth/auth-client'
import { segmentoDeRol } from '@/features/auth/roles'

// Manda a cada usuario al segmento de su rol. El proxy ya redirige a /login si no hay cookie;
// acá se cubre el caso en que la cookie existe pero la sesión no sirve.
export default function Home() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <p className="p-8 text-sm text-slate-500">Cargando…</p>

  if (!session) redirect('/login')

  const segmento = segmentoDeRol(session.user.role)
  if (segmento) redirect(segmento)

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Aula Click</h1>
      <p className="mt-2 text-sm text-slate-600">
        Tu rol todavía no tiene pantallas en esta versión.
      </p>
    </main>
  )
}
