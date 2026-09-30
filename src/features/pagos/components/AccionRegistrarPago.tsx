'use client'

import { useState } from 'react'
import { Banknote } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import type { SolicitudRegistrarPago } from '@/types/pago'

import { aCobrarDesdeDetalle } from '../a-cobrar'
import { RegistrarPagoDialog } from './RegistrarPagoDialog'

export type AccionRegistrarPagoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * "Registrar pago" en el pie del detalle del turno (HU-15). El botón se muestra solo según
 * `ocurrencia.acciones.registrarPago.visible`, que decide la API: ninguna regla propia.
 *
 * El diálogo se arma con una copia de la ocurrencia tomada al abrir y queda montado hasta que se
 * cierra, aunque el botón ya no se vea: registrar invalida el detalle, que vuelve con la acción
 * oculta, y el paso de éxito (o el rechazo) tiene que seguir en pantalla.
 */
export function AccionRegistrarPago({ ocurrencia }: AccionRegistrarPagoProps) {
  const [solicitud, setSolicitud] = useState<Omit<SolicitudRegistrarPago, 'onCerrar'> | null>(null)

  const abrir = () =>
    setSolicitud({ alumnoId: ocurrencia.alumno.id, ocurrencias: [aCobrarDesdeDetalle(ocurrencia)] })

  return (
    <>
      {ocurrencia.acciones.registrarPago.visible && (
        <Button size="lg" onClick={abrir}>
          <Banknote />
          Registrar pago
        </Button>
      )}
      {solicitud && <RegistrarPagoDialog {...solicitud} onCerrar={() => setSolicitud(null)} />}
    </>
  )
}
