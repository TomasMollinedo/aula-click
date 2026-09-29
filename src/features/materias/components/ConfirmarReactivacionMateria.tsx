'use client'

import Link from 'next/link'
import { AlertCircle, Pencil } from 'lucide-react'

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

import { CODIGO_MATERIA_SIN_PRECIO, mensajeErrorAccion } from '../errores-api'
import { useReactivarMateria } from '../hooks/use-reactivar-materia'
import type { MateriaDetalle } from '../materias.types'

type ConfirmarReactivacionMateriaProps = {
  /**
   * Materia a reactivar; `null` cierra el diálogo. Alcanza con el id, el nombre y `sinPrecio`, así
   * lo abren tanto el detalle como una fila del listado.
   */
  materia: Pick<MateriaDetalle, 'id' | 'nombre' | 'sinPrecio'> | null
  /** URL de la edición de esta materia, para cargarle el precio si no lo tiene. */
  hrefEditar: string
  /** Al ir a la edición con el link (para que cerrarla vuelva atrás). */
  onEditar: () => void
  /** Cierra el diálogo: al cancelar, al cerrar un rechazo y también después de reactivar. */
  onCerrar: () => void
}

/**
 * Confirmación de la reactivación de una materia (`PATCH /materias/{id}/reactivacion`). Sin URL
 * propia, como la baja. Una materia "Sin precio" (lo dice la API con `sinPrecio`) no se puede
 * reactivar: en lugar de intentarlo, avisa que primero hay que cargar el precio y ofrece "Editar".
 * Si igual llega el 409 `MATERIA_SIN_PRECIO` (la regla la decide la API), se muestra lo mismo. El
 * 403 y cualquier otro error quedan en el diálogo, como en la baja.
 */
export function ConfirmarReactivacionMateria({
  materia,
  hrefEditar,
  onEditar,
  onCerrar,
}: ConfirmarReactivacionMateriaProps) {
  const mutation = useReactivarMateria()
  const toast = useToast()

  const sinPrecio =
    materia?.sinPrecio === true || mutation.error?.code === CODIGO_MATERIA_SIN_PRECIO
  const mensajeError =
    mutation.error && mutation.error.code !== CODIGO_MATERIA_SIN_PRECIO
      ? mensajeErrorAccion(mutation.error)
      : null

  const cerrar = () => {
    // Sin esto, volver a abrir el diálogo mostraría el error del intento anterior.
    mutation.reset()
    onCerrar()
  }

  const confirmar = () => {
    if (!materia) return
    mutation.mutate(materia.id, {
      onSuccess: (actualizada) => {
        toast.success(`Se reactivó la materia ${actualizada.nombre}`)
        cerrar()
      },
    })
  }

  return (
    <Dialog
      open={materia !== null}
      onOpenChange={(open) => !open && !mutation.isPending && cerrar()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sinPrecio ? 'Falta cargar el precio' : 'Reactivar la materia'}</DialogTitle>
          <DialogDescription>
            {materia &&
              (sinPrecio ? (
                <>
                  <span className="font-medium">{materia.nombre}</span> no tiene precio por hora.
                  Para reactivarla, primero cargale el precio desde &quot;Editar&quot; y después
                  reactivala.
                </>
              ) : (
                <>
                  <span className="font-medium">{materia.nombre}</span> vuelve a estar activa: se
                  puede asignar a profesores y usar para registrar turnos.
                </>
              ))}
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
            {mensajeError || sinPrecio ? 'Cerrar' : 'Cancelar'}
          </Button>
          {sinPrecio ? (
            <Button variant="accent" asChild>
              <Link
                href={hrefEditar}
                scroll={false}
                onClick={() => {
                  mutation.reset()
                  onEditar()
                  onCerrar()
                }}
              >
                <Pencil />
                Editar
              </Link>
            </Button>
          ) : (
            !mensajeError && (
              <Button variant="confirmado" onClick={confirmar} disabled={mutation.isPending}>
                {mutation.isPending ? 'Reactivando…' : 'Reactivar'}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
