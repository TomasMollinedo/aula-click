'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { useMiUsuario } from '../hooks/use-mi-usuario'

export type AvisoContrasenaInicialProps = {
  /** La URL de "Configuración" en el segmento del rol (la feature no escribe el segmento). */
  hrefConfiguracion: string
}

/**
 * Aviso del portal (HU-28) mientras el alumno siga con la contraseña inicial (`contrasenaInicial`
 * de `GET /usuarios/mi-usuario`): no bloquea nada y lleva a Configuración. Se va al cambiarla
 * (la mutación invalida mi usuario) y vuelve si la mesa de entrada la restablece. Mientras carga o
 * si no se puede leer, no muestra nada.
 */
export function AvisoContrasenaInicial({ hrefConfiguracion }: AvisoContrasenaInicialProps) {
  const { data } = useMiUsuario()
  if (!data?.contrasenaInicial) return null

  return (
    <Alert className="border-urgente/40 bg-urgente/5">
      <ShieldAlert className="size-4" />
      <AlertDescription className="text-foreground">
        Por seguridad, te recomendamos cambiar tu contraseña.{' '}
        <Link
          href={hrefConfiguracion}
          className="text-cobalto font-semibold underline-offset-4 hover:underline"
        >
          Ir a Configuración
        </Link>
      </AlertDescription>
    </Alert>
  )
}
