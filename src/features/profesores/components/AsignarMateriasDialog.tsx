'use client'

import { useState } from 'react'
import { AlertCircle, BookOpen, Check } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useMateriasSelector } from '@/features/materias/hooks/use-materias-selector'
import { useToast } from '@/hooks/use-toast'

import { textoErrorMaterias } from '../errores-materias'
import { useAsignarMaterias } from '../hooks/use-asignar-materias'
import type { MateriaAsignada } from '../profesores.types'

type AsignarMateriasDialogProps = {
  profesorId: number
  /** Nombre completo del profesor, para el encabezado y el toast. */
  nombreProfesor: string
  /** Materias que ya tiene asignadas: se muestran marcadas y no se pueden destildar acá. */
  asignadas: MateriaAsignada[]
  open: boolean
  onCerrar: () => void
}

type Paso = 'seleccion' | 'confirmacion'

// Diálogo para asignar una o varias materias (POST /profesores/{id}/materias), todas o ninguna.
// Solo se eligen materias activas (GET /materias/selector) que el profesor no tenga ya asignadas.
// "Guardar" pasa a un paso de confirmación con lo que se va a asignar antes de llamar a la API.
export function AsignarMateriasDialog({
  profesorId,
  nombreProfesor,
  asignadas,
  open,
  onCerrar,
}: AsignarMateriasDialogProps) {
  const selector = useMateriasSelector()
  const mutation = useAsignarMaterias(profesorId)
  const toast = useToast()
  const [paso, setPaso] = useState<Paso>('seleccion')
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())

  const idsAsignados = new Set(asignadas.map((materia) => materia.id))
  const materiasSeleccionadas = (selector.data ?? []).filter((materia) =>
    seleccionadas.has(materia.id),
  )

  const cerrar = () => {
    if (mutation.isPending) return
    setPaso('seleccion')
    setSeleccionadas(new Set())
    onCerrar()
  }

  const alternar = (materiaId: number, marcado: boolean) => {
    setSeleccionadas((actual) => {
      const siguiente = new Set(actual)
      if (marcado) siguiente.add(materiaId)
      else siguiente.delete(materiaId)
      return siguiente
    })
  }

  const confirmar = () => {
    mutation.mutate([...seleccionadas], {
      onSuccess: () => {
        const nombres = materiasSeleccionadas.map((materia) => materia.nombre).join(', ')
        toast.success(
          materiasSeleccionadas.length === 1
            ? `Se asignó ${nombres} a ${nombreProfesor}`
            : `Se asignaron ${materiasSeleccionadas.length} materias a ${nombreProfesor}: ${nombres}`,
        )
        cerrar()
      },
      onError: (error) => {
        toast.error(textoErrorMaterias(error))
        cerrar()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {paso === 'seleccion' ? 'Asignar materias' : 'Confirmar asignación'}
          </DialogTitle>
          <DialogDescription>
            {paso === 'seleccion' ? (
              <>Elegí las materias activas que se le van a asignar a {nombreProfesor}.</>
            ) : (
              <>
                Se {materiasSeleccionadas.length === 1 ? 'va a asignar' : 'van a asignar'} a{' '}
                {nombreProfesor}:
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {paso === 'seleccion' ? (
          selector.isLoading ? (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : selector.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
                {selector.error.message}
                <Button variant="outline" size="sm" onClick={() => selector.refetch()}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : selector.data && selector.data.length > 0 ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {selector.data.map((materia) => {
                const yaAsignada = idsAsignados.has(materia.id)
                return (
                  <li key={materia.id}>
                    <label
                      className={
                        yaAsignada
                          ? 'bg-confirmado/10 flex items-center gap-3 rounded-lg px-3 py-2.5'
                          : 'hover:bg-canvas flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5'
                      }
                    >
                      <Checkbox
                        checked={yaAsignada || seleccionadas.has(materia.id)}
                        disabled={yaAsignada}
                        onCheckedChange={(marcado) => alternar(materia.id, marcado === true)}
                      />
                      <span className="flex-1 font-medium">{materia.nombre}</span>
                      {yaAsignada && (
                        <Badge variant="confirmado">
                          <Check className="size-3" />
                          Asignada
                        </Badge>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No hay materias activas"
              description="Creá una materia activa para poder asignarla."
              className="py-8"
            />
          )
        ) : (
          <ul className="space-y-2">
            {materiasSeleccionadas.map((materia) => (
              <li
                key={materia.id}
                className="bg-canvas flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium"
              >
                <BookOpen className="text-cobalto size-4" />
                {materia.nombre}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {paso === 'seleccion' ? (
            <>
              <Button variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button disabled={seleccionadas.size === 0} onClick={() => setPaso('confirmacion')}>
                Guardar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setPaso('seleccion')}
                disabled={mutation.isPending}
              >
                Volver
              </Button>
              <Button onClick={confirmar} disabled={mutation.isPending}>
                {mutation.isPending ? 'Asignando…' : 'Confirmar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
