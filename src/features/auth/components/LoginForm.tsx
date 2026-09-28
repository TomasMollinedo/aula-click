'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/features/auth/auth-client'
import { loginSchema, type LoginInput } from '@/features/auth/auth.schema'
import { interpretarErrorLogin } from '@/features/auth/interpretar-error-login'
import { segmentoDeRol } from '@/features/auth/roles'

export function LoginForm() {
  const router = useRouter()

  const [errorDelLogin, setErrorDelLogin] = useState<string | null>(null)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const enviar = handleSubmit(async (valores) => {
    setErrorDelLogin(null)

    const { data, error } = await authClient.signIn.email(valores)

    if (error) {
      setErrorDelLogin(interpretarErrorLogin(error))
      return
    }

    router.replace(segmentoDeRol(data.user.role) ?? '/')
  })

  return (
    <form noValidate onSubmit={enviar} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>

        <div className="relative">
          <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />

          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@institucion.edu"
            aria-invalid={errors.email ? true : undefined}
            className="h-12 pl-9"
            {...register('email')}
          />
        </div>

        {errors.email && (
          <p role="alert" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>

        <div className="relative">
          <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />

          <Input
            id="password"
            type={mostrarPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            aria-invalid={errors.password ? true : undefined}
            className="h-12 pr-10 pl-9"
            {...register('password')}
          />

          <button
            type="button"
            onClick={() => setMostrarPassword((valor) => !valor)}
            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
          >
            {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {errors.password && (
          <p role="alert" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      {errorDelLogin && (
        <Alert variant="destructive">
          <AlertDescription role="alert">{errorDelLogin}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting} size="lg" className="h-12 w-full">
        {isSubmitting ? (
          'Ingresando…'
        ) : (
          <>
            Ingresar
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}
