import { Suspense } from 'react'

import { AvisoSesionExpirada } from '@/features/auth/components/AvisoSesionExpirada'
import { LoginForm } from '@/features/auth/components/LoginForm'

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      <Suspense>
        <AvisoSesionExpirada />
      </Suspense>
      <LoginForm />
    </main>
  )
}
