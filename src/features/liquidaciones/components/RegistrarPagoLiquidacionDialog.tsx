'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import type { LiquidacionDetalle } from '../liquidaciones.types'

export type RegistrarPagoLiquidacionDialogProps = {
  /**
   * La copia de la liquidación que guardó el detalle al abrir: el diálogo sigue montado aunque al
   * invalidarse el detalle el botón ya no se muestre.
   */
  liquidacion: LiquidacionDetalle
  /** Lo desmonta el detalle (al cancelar o al terminar). */
  onCerrar: () => void
}

/**
 * Registrar el pago de una liquidación al profesor (HU-44): la transferencia por el total de la
 * liquidación, con su comprobante opcional. Lo abre "Registrar pago" del detalle. La completa T-132.
 */
export function RegistrarPagoLiquidacionDialog({
  liquidacion,
  onCerrar,
}: RegistrarPagoLiquidacionDialogProps) {
  void liquidacion
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Próximamente</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
