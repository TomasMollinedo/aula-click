'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'

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
import { useToast } from '@/hooks/use-toast'

import { textoErrorMaterias } from '../errores-materias'
import { useQuitarMaterias } from '../hooks/use-quitar-materias'
import type { MateriaAsignada } from '../profesores.types'

type QuitarMateriasDialogProps = {
  profesorId: number
  /** Nombre completo del profesor, para el encabezado y el toast. */
  nombreProfesor: string
  /** Materias asignadas hoy: todas se pueden elegir para quitar. */
  asignadas: MateriaAsignada[]
  open: boolean
  onCerrar: () => void
}

type Paso = 'seleccion' | 'confirmacion'

// Diálogo para quitar una o varias materias (DELETE /profesores/{id}/materias), todas o ninguna:
// baja lógica de la asignación. Si el profesor tiene turnos vigentes de alguna, la API responde
// 409 TURNOS_VIGENTES y no se quita ninguna (se avisa por toast, igual que las bajas de bloques).
export function QuitarMateriasDialog({
  profesorId,
  nombreProfesor,
  asignadas,
  open,
  onCerrar,
}: QuitarMateriasDialogProps) {
  const mutation = useQuitarMaterias(profesorId)
  const toast = useToast()
  const [paso, setPaso] = useState<Paso>('seleccion')
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())

  const materiasSeleccionadas = asignadas.filter((materia) => seleccionadas.has(materia.id))

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
            ? `Se quitó ${nombres} de ${nombreProfesor}`
            : `Se quitaron ${materiasSeleccionadas.length} materias de ${nombreProfesor}: ${nombres}`,
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
          <DialogTitle>{paso === 'seleccion' ? 'Quitar materias' : 'Confirmar baja'}</DialogTitle>
          <DialogDescription>
            {paso === 'seleccion' ? (
              <>
                Elegí las materias que se le van a quitar a {nombreProfesor}. Es una baja lógica: no
                se puede si tiene turnos vigentes de esa materia.
              </>
            ) : (
              <>
                Se {materiasSeleccionadas.length === 1 ? 'va a quitar' : 'van a quitar'} a{' '}
                {nombreProfesor}:
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {paso === 'seleccion' ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {asignadas.map((materia) => (
              <li key={materia.id}>
                <label className="hover:bg-canvas flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5">
                  <Checkbox
                    checked={seleccionadas.has(materia.id)}
                    onCheckedChange={(marcado) => alternar(materia.id, marcado === true)}
                  />
                  <span className="font-medium">{materia.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {materiasSeleccionadas.map((materia) => (
              <li
                key={materia.id}
                className="bg-canvas flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium"
              >
                <BookOpen className="text-cancelado size-4" />
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
              <Button
                variant="destructive"
                disabled={seleccionadas.size === 0}
                onClick={() => setPaso('confirmacion')}
              >
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
              <Button variant="destructive" onClick={confirmar} disabled={mutation.isPending}>
                {mutation.isPending ? 'Quitando…' : 'Confirmar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
