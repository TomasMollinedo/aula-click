'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { AlertCircle, CalendarClock, Eye, Info, Pencil, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { agruparHorario, type BloqueAgrupado, etiquetaProximaFecha, rangoHoras } from '../horario'
import { parsearParamBloque } from '../profesores.schema'
import type { ProfesorDetalle } from '../profesores.types'
import { useHorarioProfesor } from '../hooks/use-horario-profesor'
import { useMateriasAsignadas } from '../hooks/use-materias-asignadas'
import { BloqueDetalleModal } from './BloqueDetalleModal'
import { BloquePanel } from './BloquePanel'
import { type BajaDeBloque, ConfirmarBajaBloque } from './ConfirmarBajaBloque'

type HorarioProfesorProps = {
  profesor: ProfesorDetalle
  /** URL del detalle del profesor en el segmento del rol (por ejemplo `/mesa/profesores/3`). */
  rutaDetalle: string
}

/** Acciones de cada hora (editar, eliminar): ícono sin relleno, como en las tablas. */
const accionDeFila =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

// Sección "Horario de atención" de la ficha del profesor. El alta y la edición se abren como modal
// con URL propia, `?tab=horario&bloque=nuevo|<id>`, con el mismo criterio que `?editar=<id>` del
// listado (docs/arquitectura-frontend.md → Modales con URL propia). El detalle de una hora también
// es un modal, `?tab=horario&detalle=<id>`. La baja se confirma en un Dialog sin URL.
export function HorarioProfesor({ profesor, rutaDetalle }: HorarioProfesorProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const horario = useHorarioProfesor(profesor.id)
  const materias = useMateriasAsignadas(profesor.id)
  const [baja, setBaja] = useState<BajaDeBloque | null>(null)

  // Modales (formulario o detalle) abiertos con un link de esta sección que siguen en el historial:
  // cada link suma uno y cerrar vuelve atrás mientras queden. Así, detalle → Editar → cerrar vuelve
  // al detalle, y cerrarlo vuelve a la sección sin dejar entradas repetidas. Entrando por URL no
  // hay historial propio: cerrar reemplaza la URL.
  const modalesAbiertos = useRef(0)
  const bloqueParam = parsearParamBloque(searchParams.get('bloque'))
  const detalleParam = parsearParamBloque(searchParams.get('detalle'))
  const detalleId = typeof detalleParam === 'number' ? detalleParam : null
  const hrefBloque = (valor: 'nuevo' | number) => `${rutaDetalle}?tab=horario&bloque=${valor}`
  const hrefDetalle = (bloqueId: number) => `${rutaDetalle}?tab=horario&detalle=${bloqueId}`
  const marcarAbierto = () => {
    modalesAbiertos.current += 1
  }
  const cerrarModal = () => {
    if (modalesAbiertos.current > 0) {
      modalesAbiertos.current -= 1
      router.back()
      return
    }
    router.replace(`${rutaDetalle}?tab=horario`, { scroll: false })
  }

  // Solo ayuda visual: la regla la decide la API, y sus 409 se muestran igual en el formulario.
  const activo = profesor.estado === 'ACTIVO'
  const sinMaterias = materias.data?.length === 0
  // Mientras no se sabe si tiene materias, no se ofrece; si la consulta falla, decide la API.
  const puedeCargar = activo && (materias.isSuccess || materias.isError) && !sinMaterias

  // El formulario de la URL (`?bloque=`) sigue la misma ayuda visual que los botones: el alta solo
  // si se puede cargar y la edición solo con el profesor activo. Así entrar por URL no abre un
  // formulario que la sección no ofrece (la regla igual la decide la API).
  const formularioPermitido = bloqueParam === 'nuevo' ? puedeCargar : bloqueParam !== null && activo
  // Ya se sabe que no corresponde (no mientras cargan las materias): se saca el parámetro.
  const formularioDescartado =
    bloqueParam !== null && (!activo || (bloqueParam === 'nuevo' && sinMaterias))
  useEffect(() => {
    if (formularioDescartado) router.replace(`${rutaDetalle}?tab=horario`, { scroll: false })
  }, [formularioDescartado, router, rutaDetalle])

  const botonNuevo = puedeCargar && (
    <Button size="lg" asChild>
      <Link href={hrefBloque('nuevo')} onClick={marcarAbierto} scroll={false}>
        <Plus />
        Nuevo bloque
      </Link>
    </Button>
  )

  return (
    <Card className="gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarClock className="text-cobalto size-4" />
            Horario de atención
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Una fila por hora. La ocupación es la de la próxima fecha de cada día, sobre la
            capacidad efectiva de esa hora.
          </p>
        </div>
        {botonNuevo}
      </div>

      {!activo && (
        <Aviso>
          El profesor está inactivo: no se le pueden cargar ni editar bloques. Sí se pueden
          eliminar.
        </Aviso>
      )}
      {activo && sinMaterias && (
        <Aviso>
          El profesor no tiene materias asignadas, así que no se le pueden cargar bloques.
          Asignáselas en la pestaña{' '}
          <Link
            href={`${rutaDetalle}?tab=materias`}
            className="text-cobalto font-medium underline-offset-4 hover:underline"
            scroll={false}
          >
            Materias
          </Link>
          .
        </Aviso>
      )}

      {horario.isLoading ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : horario.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {horario.error.status === 403
              ? 'No tenés permiso para ver el horario del profesor'
              : horario.error.status === 404
                ? 'No se encontró el profesor'
                : horario.error.message}
            {horario.error.status !== 403 && horario.error.status !== 404 && (
              <Button variant="outline" size="sm" onClick={() => horario.refetch()}>
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : horario.data && horario.data.length > 0 ? (
        <ListaDeBloques
          bloques={agruparHorario(horario.data)}
          // La fecha local solo decide si la próxima ocurrencia se muestra como "hoy".
          hoy={format(new Date(), 'yyyy-MM-dd')}
          puedeEditar={activo}
          hrefEditar={hrefBloque}
          hrefDetalle={hrefDetalle}
          onAbrir={marcarAbierto}
          onEliminar={setBaja}
        />
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="Sin horario cargado"
          description="Todavía no tiene bloques de atención."
          className="py-10"
        >
          {botonNuevo}
        </EmptyState>
      )}

      {bloqueParam !== null && formularioPermitido && (
        <BloquePanel profesorId={profesor.id} bloque={bloqueParam} onCerrar={cerrarModal} />
      )}
      {detalleId !== null && (
        <BloqueDetalleModal
          bloqueId={detalleId}
          profesorId={profesor.id}
          onCerrar={cerrarModal}
          hrefEditar={activo ? hrefBloque(detalleId) : undefined}
          onEditar={marcarAbierto}
        />
      )}
      <ConfirmarBajaBloque profesorId={profesor.id} baja={baja} onCerrar={() => setBaja(null)} />
    </Card>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <Alert>
      <Info className="size-4" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

type ListaDeBloquesProps = {
  bloques: BloqueAgrupado[]
  hoy: string
  puedeEditar: boolean
  hrefEditar: (bloqueId: number) => string
  hrefDetalle: (bloqueId: number) => string
  /** Al abrir un modal con un link de la lista (detalle o edición). */
  onAbrir: () => void
  onEliminar: (baja: BajaDeBloque) => void
}

function ListaDeBloques({
  bloques,
  hoy,
  puedeEditar,
  hrefEditar,
  hrefDetalle,
  onAbrir,
  onEliminar,
}: ListaDeBloquesProps) {
  return (
    <ul className="space-y-4">
      {bloques.map((bloque) => {
        const titulo = `${nombreDiaSemana(bloque.diaSemana)} · ${rangoHoras(bloque.horaInicio, bloque.horaFin)} · ${bloque.aula.nombre}`
        return (
          <li key={bloque.clave} className="border-border rounded-xl border">
            <div className="bg-canvas flex flex-wrap items-center justify-between gap-2 rounded-t-xl px-4 py-3">
              <div>
                <h3 className="font-semibold">{titulo}</h3>
                <p className="text-muted-foreground text-xs">
                  {bloque.horas.length} {bloque.horas.length === 1 ? 'hora' : 'horas'}
                </p>
              </div>
              {bloque.horas.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cancelado hover:bg-cancelado/10"
                  onClick={() => onEliminar({ tipo: 'bloque', bloque })}
                >
                  <Trash2 />
                  Eliminar bloque
                </Button>
              )}
            </div>
            <ul className="divide-border divide-y">
              {bloque.horas.map((hora) => {
                const rango = rangoHoras(hora.horaInicio, hora.horaFin)
                return (
                  <li
                    key={hora.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_1fr_auto]"
                  >
                    <span className="font-medium tabular-nums">{rango}</span>
                    <span className="text-muted-foreground col-span-2 row-start-2 text-sm sm:col-span-1 sm:row-start-auto">
                      <span className="text-foreground font-medium tabular-nums">
                        {hora.ocupacion} / {hora.capacidadEfectiva}
                      </span>{' '}
                      alumnos · {etiquetaProximaFecha(hora.proximaFecha, hora.diaSemana, hoy)}
                    </span>
                    <span className="flex justify-end gap-1">
                      <Link
                        href={hrefDetalle(hora.id)}
                        onClick={onAbrir}
                        scroll={false}
                        aria-label={`Ver el detalle de la hora de ${rango}`}
                        title="Ver detalle"
                        className={cn(accionDeFila, 'text-cobalto hover:bg-cobalto/10')}
                      >
                        <Eye className="size-5" />
                      </Link>
                      {puedeEditar && (
                        <Link
                          href={hrefEditar(hora.id)}
                          onClick={onAbrir}
                          scroll={false}
                          aria-label={`Editar la hora de ${rango}`}
                          title="Editar esta hora"
                          className={cn(accionDeFila, 'text-urgente hover:bg-dorado/15')}
                        >
                          <Pencil className="size-5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => onEliminar({ tipo: 'hora', hora })}
                        aria-label={`Eliminar la hora de ${rango}`}
                        title="Eliminar esta hora"
                        className={cn(accionDeFila, 'text-cancelado hover:bg-cancelado/10')}
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
