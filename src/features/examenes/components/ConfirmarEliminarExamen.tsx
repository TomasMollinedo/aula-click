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

import { mensajeErrorAccion } from '../errores-api'
import type { ExamenItem } from '../examenes.types'
import { resumenExamen } from '../formato-examenes'
import { useEliminarExamen } from '../hooks/use-eliminar-examen'

type ConfirmarEliminarExamenProps = {
  /** Examen a eliminar; `null` cierra el diálogo. */
  examen: ExamenItem | null
  /** Cierra el diálogo: al cancelar, al cerrar un error y también después de eliminar. */
  onCerrar: () => void
}

/**
 * Confirmación de eliminar un examen (`PATCH /examenes/{id}/baja`, HU-17). Sin URL propia. Si la
 * API lo rechaza, el diálogo queda abierto con el error.
 */
export function ConfirmarEliminarExamen({ examen, onCerrar }: ConfirmarEliminarExamenProps) {
  const mutation = useEliminarExamen()
  const toast = useToast()

  const mensajeError = mutation.error ? mensajeErrorAccion(mutation.error) : null

  const cerrar = () => {
    // Sin esto, volver a abrir el diálogo mostraría el error del intento anterior.
    mutation.reset()
    onCerrar()
  }

  const confirmar = () => {
    if (!examen) return
    mutation.mutate(examen.id, {
      onSuccess: (eliminado) => {
        toast.success(`Se eliminó el examen de ${eliminado.materia.nombre}`)
        cerrar()
      },
    })
  }

  return (
    <Dialog
      open={examen !== null}
      onOpenChange={(open) => !open && !mutation.isPending && cerrar()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar examen</DialogTitle>
          <DialogDescription>
            {examen && (
              <>
                Se va a eliminar el examen de{' '}
                <span className="font-medium">{examen.materia.nombre}</span> (
                {resumenExamen(examen)}). Deja de contar para la prioridad de los turnos del alumno.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {mensajeError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">{mensajeError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={mutation.isPending}>
            {mensajeError ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!mensajeError && (
            <Button variant="destructive" onClick={confirmar} disabled={mutation.isPending}>
              {mutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
