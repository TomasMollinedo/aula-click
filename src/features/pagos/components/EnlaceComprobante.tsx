import { Receipt } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { textoNumeroComprobante } from '../formato-pagos'
import { hrefComprobante } from '../rutas-pagos'

export type EnlaceComprobanteProps = {
  pagoId: number
  numeroComprobante: number
}

/**
 * "Ver comprobante" de un pago ya registrado, en la sección de pago del detalle del turno (HU-15).
 * Abre el documento imprimible en otra pestaña, como "Imprimir comprobante" del diálogo de cobro.
 * Lo compone `app/` (`renderComprobante` de `OcurrenciaDetalle`), solo para mesa de entradas.
 */
export function EnlaceComprobante({ pagoId, numeroComprobante }: EnlaceComprobanteProps) {
  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={hrefComprobante(pagoId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ver comprobante: ${textoNumeroComprobante(numeroComprobante)} (se abre en otra pestaña)`}
      >
        <Receipt />
        Ver comprobante
      </a>
    </Button>
  )
}
