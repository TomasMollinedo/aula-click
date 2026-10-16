'use client'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

import { errorDeAdjunto } from '../comprobante-adjunto'
import { useQuitarAdjunto } from '../hooks/use-quitar-adjunto'

export type QuitarAdjuntoDialogProps = {
  pagoId: number
  onCerrar: () => void
}

/**
 * Quitar el comprobante adjunto de un pago con débito (HU-24), con `DELETE
 * /adjuntos/pagos/{pagoId}`. Es una baja lógica: el archivo queda guardado y el detalle, que se
 * vuelve a pedir solo, muestra "Sin comprobante adjunto". Lo ofrece el detalle solo si
 * `acciones.quitarAdjunto`. Un 404 o un 409 (`ADJUNTO_OBLIGATORIO`, `PAGO_ANULADO`) muestran el
 * mensaje de la API y el detalle también se vuelve a pedir.
 */
export function QuitarAdjuntoDialog({ pagoId, onCerrar }: QuitarAdjuntoDialogProps) {
  const toast = useToast()
  const mutation = useQuitarAdjunto(pagoId)
  const mensajeError = mutation.error ? errorDeAdjunto(mutation.error).mensaje : null

  const confirmar = () => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Se quitó el comprobante adjunto')
        onCerrar()
      },
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quitar comprobante adjunto</DialogTitle>
          <DialogDescription>
            ¿Quitar el comprobante adjunto de este pago? El archivo queda guardado en el sistema.
          </DialogDescription>
        </DialogHeader>

        {mensajeError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{mensajeError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={mutation.isPending}>
            {mensajeError ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!mensajeError && (
            <Button variant="destructive" onClick={confirmar} disabled={mutation.isPending}>
              {mutation.isPending ? 'Quitando…' : 'Quitar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
