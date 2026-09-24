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

import { profesoresQueImpidenLaBaja } from '../errores-api'
import { useDarDeBajaMateria } from '../hooks/use-dar-de-baja-materia'
import type { MateriaDetalle } from '../materias.types'
import { ProfesoresDeMateria } from './ProfesoresDeMateria'

type ConfirmarBajaMateriaProps = {
  /** `null` cierra el diálogo. */
  materia: MateriaDetalle | null
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaProfesores: string
  onCerrar: () => void
}

/**
 * Confirmación de la baja lógica de una materia (`PATCH /materias/{id}/baja`). Sin URL propia.
 * Si tiene profesores asignados la API responde 409 `MATERIA_CON_PROFESORES` y el diálogo queda
 * abierto mostrando cuántos son y cuáles, con enlace a la ficha de cada uno.
 */
export function ConfirmarBajaMateria({
  materia,
  rutaProfesores,
  onCerrar,
}: ConfirmarBajaMateriaProps) {
  const mutation = useDarDeBajaMateria()
  const toast = useToast()

  const profesores = mutation.error ? profesoresQueImpidenLaBaja(mutation.error) : []
  const mensajeError = mutation.error?.message ?? null

  const cerrar = () => {
    // Sin esto, volver a abrir el diálogo mostraría el error del intento anterior.
    mutation.reset()
    onCerrar()
  }

  const confirmar = () => {
    if (!materia) return
    mutation.mutate(materia.id, {
      onSuccess: (actualizada) => {
        toast.success(`Se dio de baja la materia ${actualizada.nombre}`)
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
          <DialogTitle>Dar de baja la materia</DialogTitle>
          <DialogDescription>
            {materia && (
              <>
                Se va a dar de baja <span className="font-medium">{materia.nombre}</span>. Es una
                baja lógica: el registro no se elimina, pero deja de poder asignarse a un profesor y
                de aparecer al registrar un turno.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {mensajeError && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">
                {mensajeError}
                {profesores.length > 0 && (
                  <>
                    {' '}
                    {profesores.length === 1
                      ? 'Hay 1 profesor que la dicta:'
                      : `Hay ${profesores.length} profesores que la dictan:`}
                  </>
                )}
              </AlertDescription>
            </Alert>
            {profesores.length > 0 && (
              <ProfesoresDeMateria profesores={profesores} rutaProfesores={rutaProfesores} />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={mutation.isPending}>
            {mensajeError ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!mensajeError && (
            <Button variant="destructive" onClick={confirmar} disabled={mutation.isPending}>
              {mutation.isPending ? 'Dando de baja…' : 'Dar de baja'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
