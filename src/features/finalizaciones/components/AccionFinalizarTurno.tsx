'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import { useInvalidarOcurrencias } from '@/features/ocurrencias/hooks/use-invalidar-ocurrencias'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import { sumarDias } from '@/utils/calendario'

import type { FinalizacionCreada } from '../finalizaciones.types'
import { FinalizarTurnoDialog } from './FinalizarTurnoDialog'

export type AccionFinalizarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Finalizar turno" en el pie del detalle (HU-14, T-48). Se muestra según
 * `ocurrencia.acciones.finalizar.visible`, que calcula la API: nunca con reglas propias.
 *
 * Después de finalizar, si la ocurrencia que muestra el detalle es de la fecha elegida en adelante,
 * dejó de existir: el detalle pasa a la última que queda (una semana antes de la fecha elegida, que
 * siempre existe porque la API exige una fecha posterior al inicio) y ahí se lee "Finalizada el …".
 */
export function AccionFinalizarTurno({ ocurrencia }: AccionFinalizarTurnoProps) {
  const [abierto, setAbierto] = useState(false)
  const router = useRouter()
  const { hrefDetalle } = useDetalleEnUrl()
  const invalidarOcurrencias = useInvalidarOcurrencias()
  const { turnoId, fecha } = ocurrencia

  // Las ocurrencias se invalidan recién cuando el detalle dejó de mostrar la que ya no existe (cambió
  // de ocurrencia o se desmontó): pedirla de nuevo antes daría un "Turno no encontrado" por un
  // instante. El detalle nuevo se pide solo; esto refresca el resto (la lista del alumno).
  const invalidarAlSalir = useRef(false)
  useEffect(
    () => () => {
      if (!invalidarAlSalir.current) return
      invalidarAlSalir.current = false
      void invalidarOcurrencias()
    },
    [turnoId, fecha, invalidarOcurrencias],
  )

  // Abierto se sigue mostrando aunque la acción deje de estar visible (otro lo finalizó mientras
  // tanto): el diálogo es el que explica por qué ya no se puede.
  if (!ocurrencia.acciones.finalizar.visible && !abierto) return null

  const alFinalizar = ({ desde }: FinalizacionCreada) => {
    if (fecha < desde) {
      void invalidarOcurrencias()
      return
    }
    invalidarAlSalir.current = true
    router.replace(hrefDetalle(turnoId, sumarDias(desde, -7)), { scroll: false })
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        Finalizar turno
      </Button>
      <FinalizarTurnoDialog
        open={abierto}
        ocurrencia={ocurrencia}
        onCerrar={() => setAbierto(false)}
        onFinalizado={alFinalizar}
      />
    </>
  )
}
