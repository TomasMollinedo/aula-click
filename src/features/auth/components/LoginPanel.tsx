import { MousePointer2 } from 'lucide-react'
import { Suspense } from 'react'

import { AvisoSesionExpirada } from '@/features/auth/components/AvisoSesionExpirada'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPanel() {
  return (
    <section className="flex min-h-screen flex-1 items-center justify-center bg-white p-6 sm:p-10">
      <div className="w-full max-w-sm">
        {/* Logo visible únicamente cuando desaparece el hero */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <span className="bg-cobalto flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <MousePointer2 className="size-5 fill-white text-white" />
          </span>

          <div>
            <p className="text-lg leading-tight font-semibold">
              <span className="text-tinta">Aula</span>
              <span className="text-cobalto">Click</span>
            </p>

            <p className="text-oscuro text-xs">Centro de Atención Académica</p>
          </div>
        </div>

        <div>
          <h2 className="text-tinta text-3xl font-semibold tracking-tight">Iniciar sesión</h2>

          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Ingresa tus credenciales para acceder al centro de atención académica.
          </p>
        </div>

        <Suspense fallback={null}>
          <AvisoSesionExpirada />
        </Suspense>

        <div className="mt-6">
          <LoginForm />
        </div>

        <div className="text-muted-foreground mt-8 flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" />

          <span className="whitespace-nowrap">Acceso para personal autorizado</span>

          <span className="bg-border h-px flex-1" />
        </div>
      </div>
    </section>
  )
}
