'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { authClient } from '@/features/auth/auth-client'
import { loginSchema, type LoginInput } from '@/features/auth/auth.schema'
import { interpretarErrorLogin } from '@/features/auth/interpretar-error-login'
import { segmentoDeRol } from '@/features/auth/roles'

const claseCampo =
  'h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900'

export function LoginForm() {
  const router = useRouter()
  const [errorDelLogin, setErrorDelLogin] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const enviar = handleSubmit(async (valores) => {
    setErrorDelLogin(null)

    const { data, error } = await authClient.signIn.email(valores)
    if (error) {
      setErrorDelLogin(interpretarErrorLogin(error))
      return
    }

    // Si el rol todavía no tiene segmento, "/" muestra el aviso en lugar de un 404.
    router.replace(segmentoDeRol(data.user.role) ?? '/')
  })

  return (
    <form noValidate onSubmit={enviar} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          className={claseCampo}
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          className={claseCampo}
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {errorDelLogin && (
        <p role="alert" className="text-sm text-red-600">
          {errorDelLogin}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-10 w-full rounded-md bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
