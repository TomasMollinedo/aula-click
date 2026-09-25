'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

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
import type { ApiError } from '@/utils/fetch-json'

import type { Estado, TurnoVigenteProfesor } from '../profesores.types'
import { useDarDeBajaProfesor } from '../hooks/use-dar-de-baja-profesor'
import { useReactivarProfesor } from '../hooks/use-reactivar-profesor'
import { textoResumenTurnos } from '../turnos-vigentes'
import { TurnosQueImpidenLaBaja } from './TurnosQueImpidenLaBaja'

/** Lo mínimo del profesor que necesita el diálogo: su estado decide qué acción confirma. */
type ProfesorEstadoResumen = { id: number; nombre: string; apellido: string; estado: Estado }

type ConfirmarEstadoProfesorProps = {
  /** `null` cierra el diálogo. */
  profesor: ProfesorEstadoResumen | null
  /** Agenda diaria del segmento del rol (`/mesa/agenda`), para ir a ver los turnos que lo impiden. */
  rutaAgenda: string
  onCerrar: () => void
}

function esTurnosVigentes(details: unknown): details is TurnoVigenteProfesor[] {
  return Array.isArray(details) && details.every((d) => d && typeof d === 'object' && 'alumno' in d)
}

// Confirmación de la baja y la reactivación del profesor (HU-06), sin trigger propio: lo abre la
// ficha (botón) o el listado (ícono de la fila), cada uno con su propio disparador, igual que
// ConfirmarBajaBloque. El estado del profesor decide la acción: ACTIVO ofrece "dar de baja",
// INACTIVO ofrece "reactivar". A diferencia de otros 409, TURNOS_VIGENTES de la baja no se avisa
// con un toast: se listan los turnos que la impiden (alumno, materia, fecha y horario) dentro del
// mismo diálogo, para no obligar a adivinar cuáles son.
export function ConfirmarEstadoProfesor({
  profesor,
  rutaAgenda,
  onCerrar,
}: ConfirmarEstadoProfesorProps) {
  const [turnosVigentes, setTurnosVigentes] = useState<TurnoVigenteProfesor[] | null>(null)
  const darDeBaja = useDarDeBajaProfesor(profesor?.id ?? 0)
  const reactivar = useReactivarProfesor(profesor?.id ?? 0)
  const toast = useToast()
  const isPending = darDeBaja.isPending || reactivar.isPending
  const accion = profesor === null ? null : profesor.estado === 'ACTIVO' ? 'baja' : 'reactivar'

  const cerrar = () => {
    if (isPending) return
    setTurnosVigentes(null)
    onCerrar()
  }

  const confirmarBaja = () => {
    darDeBaja.mutate(undefined, {
      onSuccess: (actualizado) => {
        toast.success(`Se dio de baja a ${actualizado.nombre} ${actualizado.apellido}`)
        cerrar()
      },
      onError: (error: ApiError) => {
        if (error.code === 'TURNOS_VIGENTES' && esTurnosVigentes(error.details)) {
          setTurnosVigentes(error.details)
          return
        }
        toast.error(error.message)
        cerrar()
      },
    })
  }

  const confirmarReactivacion = () => {
    reactivar.mutate(undefined, {
      onSuccess: (actualizado) => {
        toast.success(`Se reactivó a ${actualizado.nombre} ${actualizado.apellido}`)
        cerrar()
      },
      onError: (error: ApiError) => {
        toast.error(error.message)
        cerrar()
      },
    })
  }

  return (
    <Dialog open={accion !== null} onOpenChange={(open) => !open && cerrar()}>
      <DialogContent>
        {accion === 'baja' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {turnosVigentes === null ? 'Dar de baja al profesor' : 'No se puede dar de baja'}
              </DialogTitle>
              <DialogDescription>
                {turnosVigentes === null ? (
                  <>
                    Se va a dar de baja a {profesor?.nombre} {profesor?.apellido}. Deja de aparecer
                    en el listado por defecto y de estar disponible para agendar turnos nuevos; sus
                    materias, su horario y el historial de turnos se conservan tal cual. Se puede
                    reactivar más adelante.
                  </>
                ) : (
                  <>
                    {textoResumenTurnos(
                      `${profesor?.nombre ?? ''} ${profesor?.apellido ?? ''}`.trim(),
                      turnosVigentes,
                    )}{' '}
                    Para darlo de baja hay que cancelar o reasignar esos turnos.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {turnosVigentes !== null && <TurnosQueImpidenLaBaja turnos={turnosVigentes} />}

            <DialogFooter>
              <Button variant="outline" onClick={cerrar} disabled={isPending}>
                {turnosVigentes === null ? 'Cancelar' : 'Cerrar'}
              </Button>
              {turnosVigentes === null ? (
                <Button variant="destructive" onClick={confirmarBaja} disabled={isPending}>
                  {darDeBaja.isPending ? 'Dando de baja…' : 'Dar de baja'}
                </Button>
              ) : (
                <Button asChild>
                  <Link href={`${rutaAgenda}?profesorId=${profesor?.id ?? ''}`}>
                    <CalendarClock className="size-4" />
                    Ver en la agenda
                  </Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {accion === 'reactivar' && (
          <>
            <DialogHeader>
              <DialogTitle>Reactivar profesor</DialogTitle>
              <DialogDescription>
                {profesor?.nombre} {profesor?.apellido} vuelve a estar activo: puede iniciar sesión
                de nuevo, vuelve a aparecer en el listado por defecto y queda disponible para
                agendar turnos, con sus materias y su horario intactos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cerrar} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={confirmarReactivacion} disabled={isPending}>
                {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
