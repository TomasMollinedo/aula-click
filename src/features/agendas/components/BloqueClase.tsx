'use client'

import { useId } from 'react'
import Link from 'next/link'
import { ChevronDown, DoorOpen, UserRound } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/utils/cn'
import { getInitials } from '@/utils/initials'

import type { CalendarioItem } from '../agendas.types'
import { cantidadCancelados, type ClaseCalendario, textoAlumnos } from '../calendario'
import { useDetalleAgenda } from '../hooks/use-detalle-agenda'

// Cuántos alumnos se dibujan como iniciales en el resumen; el resto lo dice el texto.
const INICIALES_VISIBLES = 3

type BloqueClaseProps = {
  clase: ClaseCalendario
  expandida: boolean
  onAlternar: () => void
  /** La agenda del centro muestra el profesor de cada clase; las de un solo profesor, no. */
  mostrarProfesor: boolean
}

/**
 * Una clase en el calendario (HU-19): un único bloque por hora de un bloque del horario, con sus
 * alumnos adentro. Contraído es un resumen (horario, materia, profesor y aula según el origen, y
 * cuántos alumnos tiene); un clic lo expande y muestra cada turno con su propio estado y su
 * prioridad, porque la clase no tiene un estado ni una prioridad comunes. Un clic en un alumno
 * abre el detalle de su turno (`?detalle=&fecha=`).
 */
export function BloqueClase({ clase, expandida, onAlternar, mostrarProfesor }: BloqueClaseProps) {
  const idPanel = useId()
  const cantidad = clase.turnos.length
  const cancelados = cantidadCancelados(clase)
  const todosCancelados = cancelados === cantidad
  const materias = clase.materias.map((materia) => materia.nombre).join(' · ')

  return (
    <div
      data-slot="bloque-clase"
      className={cn(
        'overflow-hidden rounded-lg border-l-4 transition-shadow',
        todosCancelados
          ? 'border-cancelado/60 bg-muted'
          : expandida
            ? 'border-primary bg-card ring-primary/30 shadow-md ring-1'
            : 'border-primary bg-primary/10 hover:bg-primary/15',
      )}
    >
      <button
        type="button"
        aria-expanded={expandida}
        aria-controls={idPanel}
        onClick={onAlternar}
        className="focus-visible:ring-ring flex w-full flex-col gap-1 rounded-lg p-2 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span className="text-muted-foreground flex items-center justify-between gap-1 text-xs">
          <span className="tabular-nums">
            {clase.horaInicio}–{clase.horaFin}
          </span>
          <ChevronDown
            aria-hidden
            className={cn('size-4 shrink-0 transition-transform', expandida && 'rotate-180')}
          />
        </span>

        <span
          title={materias}
          className={cn(
            'line-clamp-2 text-sm leading-tight font-semibold',
            todosCancelados && 'text-muted-foreground line-through',
          )}
        >
          {materias}
        </span>

        <span className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          {mostrarProfesor && clase.profesor && (
            <span className="flex items-center gap-1">
              <UserRound aria-hidden className="size-3 shrink-0" />
              <span className="truncate">
                {clase.profesor.apellido}, {clase.profesor.nombre}
              </span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <DoorOpen aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{clase.aula.nombre}</span>
          </span>
        </span>

        <span className="mt-1 flex items-center gap-2">
          <span aria-hidden className="flex -space-x-1">
            {clase.turnos.slice(0, INICIALES_VISIBLES).map((turno) => (
              <Avatar key={turno.turnoId} className="ring-card size-5 ring-2">
                <AvatarFallback className="text-[9px]">
                  {getInitials(turno.alumno.nombre, turno.alumno.apellido)}
                </AvatarFallback>
              </Avatar>
            ))}
          </span>
          <span
            className={cn(
              'text-xs font-semibold',
              cantidad > 1 && !todosCancelados ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {textoAlumnos(cantidad)}
            {cancelados > 0 && !todosCancelados && (
              <span className="text-muted-foreground font-normal">
                {' '}
                · {cancelados === 1 ? '1 cancelado' : `${cancelados} cancelados`}
              </span>
            )}
            {todosCancelados && <span className="font-normal"> · cancelados</span>}
          </span>
        </span>
      </button>

      {expandida && (
        <ul id={idPanel} aria-label="Alumnos de la clase" className="border-border border-t p-1">
          {clase.turnos.map((turno) => (
            <TurnoDeClase
              key={turno.turnoId}
              turno={turno}
              mostrarMateria={clase.materias.length > 1}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Un alumno dentro de la clase expandida: su nombre, su estado y su prioridad. El link del nombre
 * cubre toda la fila (así se abre el detalle con un clic en cualquier parte, con el teclado y en
 * otra pestaña); la prioridad queda por encima porque su tooltip trae el examen.
 */
function TurnoDeClase({
  turno,
  mostrarMateria,
}: {
  turno: CalendarioItem
  /** Solo si la clase mezcla materias: si es una sola, ya está en el título del bloque. */
  mostrarMateria: boolean
}) {
  const { hrefDetalle, marcarAbiertoConLink } = useDetalleAgenda()
  const cancelado = turno.estado === 'CANCELADO'

  return (
    <li className="hover:bg-muted/70 relative flex flex-col gap-1 rounded-md px-2 py-1.5">
      <Link
        href={hrefDetalle(turno.turnoId, turno.fecha)}
        scroll={false}
        onClick={(e) => {
          if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) marcarAbiertoConLink()
        }}
        className={cn(
          'focus-visible:ring-ring truncate rounded-sm text-sm font-medium after:absolute after:inset-0 after:content-[""] hover:underline focus-visible:ring-2 focus-visible:outline-none',
          cancelado && 'text-muted-foreground line-through',
        )}
      >
        {turno.alumno.apellido}, {turno.alumno.nombre}
      </Link>
      {mostrarMateria && (
        <span className="text-muted-foreground truncate text-xs">{turno.materia.nombre}</span>
      )}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EstadoTurnoBadge estado={turno.estado} />
        {turno.prioridad && (
          <PrioridadIndicador
            prioridad={turno.prioridad}
            examen={turno.examen ?? undefined}
            variante="punto"
            className="relative z-10"
          />
        )}
      </span>
    </li>
  )
}
