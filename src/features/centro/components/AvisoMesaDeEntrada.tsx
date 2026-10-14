'use client'

import { Phone } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { useCentro } from '../hooks/use-centro'

/**
 * Aviso fijo del portal del alumno (HU-29/HU-30): cancelar o reprogramar un turno lo hace la mesa
 * de entrada. Muestra el teléfono del centro (`GET /centro`); mientras carga o si no se puede leer
 * (sin conexión, o el 403 del alumno hasta T-91), el aviso se ve igual, sin el teléfono.
 */
export function AvisoMesaDeEntrada() {
  const { data: centro } = useCentro()

  return (
    <Alert>
      <Phone className="size-4" />
      <AlertDescription>
        {centro?.telefono ? (
          <>
            Para cancelar o reprogramar un turno, comunicate con la mesa de entrada al{' '}
            <a
              href={`tel:${centro.telefono.replace(/[^\d+]/g, '')}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {centro.telefono}
            </a>
            .
          </>
        ) : (
          'Para cancelar o reprogramar un turno, comunicate con la mesa de entrada.'
        )}
      </AlertDescription>
    </Alert>
  )
}
