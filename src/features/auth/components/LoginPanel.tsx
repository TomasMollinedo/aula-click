import { MousePointer2 } from 'lucide-react'
import { Suspense } from 'react'

import { Card } from '@/components/ui/card'
import { AvisoSesionExpirada } from '@/features/auth/components/AvisoSesionExpirada'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPanel() {
  return (
    <section className="bg-canvas relative flex min-h-screen flex-1 items-center justify-center overflow-hidden p-6 sm:p-10">
      {/* Luz decorativa: espejo de la del hero (LoginHero), mismo dorado — el acento de marca es
          uno solo en toda la pantalla; el cobalto queda reservado para la acción (el botón). */}
      <div
        aria-hidden
        className="bg-dorado/15 pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo visible únicamente cuando desaparece el hero */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <span className="bg-dorado flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <MousePointer2 className="size-5 fill-white text-white" />
          </span>

          <div>
            <p className="text-lg leading-tight font-semibold">
              <span className="text-tinta">Aula</span>
              <span className="text-dorado">Click</span>
            </p>

            <p className="text-oscuro text-xs">Centro de Atención Académica</p>
          </div>
        </div>

        <Card className="shadow-dorado/10 gap-0 p-8 shadow-lg">
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
        </Card>
      </div>
    </section>
  )
}
