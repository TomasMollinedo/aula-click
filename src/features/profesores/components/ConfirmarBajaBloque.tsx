'use client'

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
import { nombreDiaSemana } from '@/utils/dias-semana'
import type { ApiError } from '@/utils/fetch-json'

import { textoErrorBloque } from '../errores-bloques'
import { type BloqueAgrupado, rangoHoras } from '../horario'
import type { BloqueHorario } from '../profesores.types'
import { useEliminarBloque } from '../hooks/use-eliminar-bloque'
import { useEliminarBloques } from '../hooks/use-eliminar-bloques'

/** Qué se va a dar de baja: una hora, o el bloque completo que se ve agrupado. */
export type BajaDeBloque =
  { tipo: 'hora'; hora: BloqueHorario } | { tipo: 'bloque'; bloque: BloqueAgrupado }

type ConfirmarBajaBloqueProps = {
  profesorId: number
  /** `null` cierra el diálogo. */
  baja: BajaDeBloque | null
  onCerrar: () => void
}

/** `"la hora de 9:00 a 10:00 del lunes"` o `"el bloque del lunes de 8:00 a 12:00 (4 horas)"`. */
function descripcionBaja(baja: BajaDeBloque): string {
  if (baja.tipo === 'hora') {
    const { hora } = baja
    return `la hora de ${rangoHoras(hora.horaInicio, hora.horaFin)} del ${nombreDiaSemana(hora.diaSemana).toLowerCase()}`
  }
  const { bloque } = baja
  return `el bloque del ${nombreDiaSemana(bloque.diaSemana).toLowerCase()} de ${rangoHoras(bloque.horaInicio, bloque.horaFin)} (${bloque.horas.length} horas)`
}

// Confirmación de la baja de una hora (`DELETE /bloques/{id}`) o de un bloque completo
// (`DELETE /bloques` con los ids de sus horas, todo o nada). Sin URL propia. El resultado se avisa
// con un toast: es una acción de fila, sin un formulario donde mostrar el error.
export function ConfirmarBajaBloque({ profesorId, baja, onCerrar }: ConfirmarBajaBloqueProps) {
  const eliminarHora = useEliminarBloque(profesorId)
  const eliminarBloque = useEliminarBloques(profesorId)
  const toast = useToast()
  const isPending = eliminarHora.isPending || eliminarBloque.isPending

  const confirmar = () => {
    if (!baja) return
    const descripcion = descripcionBaja(baja)
    const callbacks = {
      onSuccess: () => {
        toast.success(`Se dio de baja ${descripcion}`)
        onCerrar()
      },
      onError: (error: ApiError) => {
        toast.error(textoErrorBloque(error))
        onCerrar()
      },
    }
    if (baja.tipo === 'hora') eliminarHora.mutate(baja.hora.id, callbacks)
    else
      eliminarBloque.mutate(
        baja.bloque.horas.map((hora) => hora.id),
        callbacks,
      )
  }

  return (
    <Dialog open={baja !== null} onOpenChange={(open) => !open && !isPending && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {baja?.tipo === 'bloque' ? 'Eliminar bloque completo' : 'Eliminar hora'}
          </DialogTitle>
          <DialogDescription>
            {baja && (
              <>
                Se va a dar de baja {descripcionBaja(baja)}. Es una baja: deja de aparecer en el
                horario y no admite turnos nuevos. No se puede si tiene turnos vigentes.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={isPending}>
            {isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
