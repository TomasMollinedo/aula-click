'use client'

import Link from 'next/link'
import { UserRound } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { cn } from '@/utils/cn'

import type { TurnoEnGrilla } from '../calendario-alumno'
import { useDetalleAgenda } from '../hooks/use-detalle-agenda'

type BloqueTurnoAlumnoProps = {
  turno: TurnoEnGrilla
  /** El turno es de un día anterior a hoy: se ve atenuado porque ya no tiene relevancia. */
  esPasado: boolean
}

/**
 * Un turno del alumno en su calendario: horario, materia, profesor y, si corresponde, el estado
 * (solo cancelado: agendado y sin registrar no se muestran, igual que en `BloqueClase`) y la
 * prioridad. Es un link a su detalle (`?detalle=&fecha=`), que abre la ficha del alumno. El estado,
 * la prioridad y el pago los calcula la API; acá solo se muestran.
 */
export function BloqueTurnoAlumno({ turno, esPasado }: BloqueTurnoAlumnoProps) {
  const { hrefDetalle, marcarAbiertoConLink } = useDetalleAgenda()
  const cancelado = turno.estado === 'CANCELADO'

  return (
    <Link
      href={hrefDetalle(turno.turnoId, turno.fecha)}
      scroll={false}
      onClick={(e) => {
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) marcarAbiertoConLink()
      }}
      data-slot="bloque-turno-alumno"
      className={cn(
        'focus-visible:ring-ring flex flex-col gap-1 rounded-lg border-l-4 p-2 text-left transition focus-visible:ring-2 focus-visible:outline-none',
        cancelado
          ? 'border-cancelado/60 bg-muted'
          : 'border-primary bg-primary/10 hover:bg-primary/15',
        // Un turno pasado ya no importa: se atenúa, pero sigue legible y se recupera al apuntarlo.
        esPasado && 'opacity-55 hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <span className="text-muted-foreground flex items-center justify-between gap-1 text-xs">
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

      {turno.prioridad && (
        <PrioridadIndicador prioridad={turno.prioridad} variante="punto" className="mt-0.5" />
      )}
    </Link>
  )
}
