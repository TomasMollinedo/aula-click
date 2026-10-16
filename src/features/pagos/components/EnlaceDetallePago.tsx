'use client'

import Link from 'next/link'
import { FileSearch } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useDetallePagoEnUrl } from '../hooks/use-detalle-pago-en-url'

export type EnlaceDetallePagoProps = {
  pagoId: number
}

/**
 * "Ver pago" en la sección "Pago" del detalle de un turno pagado: abre el detalle del pago
 * (`?pago=<pagoId>`) encima del detalle del turno, que se conserva en la URL. Es un `Link` (`push`):
 * Atrás o "Cerrar" lo cierran y vuelve al detalle del turno. Lo compone `app/`
 * (`renderComprobante` de `OcurrenciaDetalle`); el detalle lo muestra el layout de mesa.
 */
export function EnlaceDetallePago({ pagoId }: EnlaceDetallePagoProps) {
  const { hrefPago, marcarAbiertoConLink } = useDetallePagoEnUrl()

  return (
    <Button asChild variant="outline">
      <Link href={hrefPago(pagoId)} scroll={false} onClick={() => marcarAbiertoConLink(pagoId)}>
        <FileSearch />
        Ver pago
      </Link>
    </Button>
  )
}
