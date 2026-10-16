'use client'

import Link from 'next/link'
import { MapPin, UserRound } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import type { OcurrenciaDelPortal } from '@/types/ocurrencia'
import { cn } from '@/utils/cn'

import { useDetalleAgenda } from '../hooks/use-detalle-agenda'

type BloqueMiTurnoProps = {
  turno: OcurrenciaDelPortal
  /** El turno es de un día anterior a hoy: se ve atenuado, como en los otros calendarios. */
  esPasado: boolean
}

/**
 * Un turno en "Mi calendario" del portal, igual en la grilla y en la lista: horario, materia,
 * profesor y aula. Solo una cancelada lleva estado ("Cancelado", con su color): si el turno está, está
 * agendado, y la asistencia solo se ve en el detalle. Es un link a su detalle (`?detalle=&fecha=`). Sin
 * prioridad, ocupación ni cupos: la API no los manda al alumno.
 */
export function BloqueMiTurno({ turno, esPasado }: BloqueMiTurnoProps) {
  const { hrefDetalle, marcarAbiertoConLink } = useDetalleAgenda()
  const cancelado = turno.estado === 'CANCELADO'

  return (
    <Link
      href={hrefDetalle(turno.turnoId, turno.fecha)}
      scroll={false}
      onClick={(e) => {
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) marcarAbiertoConLink()
      }}
      data-slot="bloque-mi-turno"
      className={cn(
        'focus-visible:ring-ring flex flex-col gap-1 rounded-lg border-l-4 p-2 text-left transition focus-visible:ring-2 focus-visible:outline-none',
        cancelado
          ? 'border-cancelado/60 bg-muted'
          : 'border-primary bg-primary/10 hover:bg-primary/15',
        esPasado && 'opacity-55 hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <span className="text-muted-foreground flex flex-wrap items-center justify-between gap-1 text-xs">
        <span className="tabular-nums">
          {turno.horaInicio}–{turno.horaFin}
        </span>
        {cancelado && <EstadoTurnoBadge estado={turno.estado} />}
      </span>

      <span
        title={turno.materia.nombre}
        className={cn(
          'line-clamp-2 text-sm leading-tight font-semibold',
          cancelado && 'text-muted-foreground line-through',
        )}
      >
        {turno.materia.nombre}
      </span>

      <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
        <UserRound aria-hidden className="size-3 shrink-0" />
        <span className="truncate">
          {turno.profesor.apellido}, {turno.profesor.nombre}
        </span>
      </span>

      <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
        <MapPin aria-hidden className="size-3 shrink-0" />
        <span className="truncate">{turno.aula.nombre}</span>
      </span>
    </Link>
  )
}
