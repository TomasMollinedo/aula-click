'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, KeyRound } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

import { interpretarErrorContrasena } from '../errores-api'
import { useCambiarContrasena } from '../hooks/use-cambiar-contrasena'
import {
  type CambiarContrasenaForm,
  type CampoContrasena as Campo,
  VALORES_VACIOS,
  cambiarContrasenaSchema,
} from '../usuarios.schema'
import { CampoContrasena } from './CampoContrasena'

/**
 * "Configuración" del portal: cambiar la contraseña (HU-28). Actual, nueva y repetición,
 * enmascaradas con la opción de mostrarlas. Las reglas las valida la API y cada error suyo se ve en
 * su campo. Al terminar bien: "Contraseña actualizada", el formulario vacío y la sesión abierta.
 */
export function CambiarContrasena() {
  const cambiar = useCambiarContrasena()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CambiarContrasenaForm>({
    resolver: zodResolver(cambiarContrasenaSchema),
    defaultValues: VALORES_VACIOS,
  })

  const errorApi = useMemo(
    () => (cambiar.error ? interpretarErrorContrasena(cambiar.error) : null),
    [cambiar.error],
  )
  const errorDe = (campo: Campo) =>
    errors[campo]?.message ?? errorApi?.campos.find((c) => c.campo === campo)?.mensaje

  const guardar = handleSubmit((datos) => {
    cambiar.mutate(datos, {
      onSuccess: () => {
        toast.success('Contraseña actualizada')
        reset(VALORES_VACIOS)
        cambiar.reset()
      },
    })
  })

  return (
    <Card className="space-y-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound aria-hidden className="text-cobalto size-4" />
        Cambiar contraseña
      </h2>

      <form onSubmit={guardar} className="space-y-4" noValidate>
        <CampoContrasena
          id="contrasena-actual"
          label="Contraseña actual"
          autoComplete="current-password"
          error={errorDe('actual')}
          {...register('actual')}
        />
        <CampoContrasena
          id="contrasena-nueva"
          label="Contraseña nueva"
          autoComplete="new-password"
          error={errorDe('nueva')}
          {...register('nueva')}
        />
        <CampoContrasena
          id="contrasena-repeticion"
          label="Repetí la contraseña nueva"
          autoComplete="new-password"
          error={errorDe('repeticion')}
          {...register('repeticion')}
        />

        {errorApi?.mensaje && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{errorApi.mensaje}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="confirmado"
            size="lg"
            className="w-full sm:w-auto"
            disabled={cambiar.isPending}
          >
            {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
