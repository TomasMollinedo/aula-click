'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { EstadoPagoBadge } from '@/components/turno/estado-pago-badge'
import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { TableCell, TableRow } from '@/components/ui/table'

import type { AgendaItem, AgendaOcurrencia } from '../agendas.types'
import { useDetalleAgenda } from '../hooks/use-detalle-agenda'

export type ColumnasAgenda = {
  /** La agenda diaria muestra el profesor de cada turno; las de un solo profesor, no. */
  profesor: boolean
  /** El estado de pago lo ve mesa de entradas: "Mi agenda" del profesor no lo muestra. */
  pago: boolean
}

/** Cantidad de columnas de la tabla, para el `colSpan` de los encabezados de día y del vacío. */
export function cantidadDeColumnas({ profesor, pago }: ColumnasAgenda): number {
  return 5 + (profesor ? 1 : 0) + (pago ? 1 : 0)
}

type FilaOcurrenciaProps = {
  turno: AgendaOcurrencia & Partial<Pick<AgendaItem, 'profesor'>>
  columnas: ColumnasAgenda
}

/**
 * Una fila de la agenda (HU-18, HU-13, HU-15): horario con la prioridad (franja lateral, punto y
 * palabra; el tooltip trae el examen), alumno, materia, aula, estado y, si se pide, el estado de
 * pago. Todo lo que se ve viene de la API. Un clic en la fila abre el detalle (`?detalle=&fecha=`);
 * el link del alumno es el acceso con teclado y el que permite abrirlo en otra pestaña.
 */
export function FilaOcurrencia({ turno, columnas }: FilaOcurrenciaProps) {
  const router = useRouter()
  const { hrefDetalle, marcarAbiertoConLink } = useDetalleAgenda()
  const href = hrefDetalle(turno.turnoId, turno.fecha)

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        // El tooltip de la prioridad y el link del alumno resuelven su propio clic.
        if ((e.target as HTMLElement).closest('a, button')) return
        marcarAbiertoConLink()
        router.push(href, { scroll: false })
      }}
    >
      {/* `relative`: la franja de prioridad se ubica en el borde izquierdo de esta primera celda. */}
      <TableCell className="relative whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <span className="tabular-nums">
            {turno.horaInicio}–{turno.horaFin}
          </span>
          {turno.prioridad && (
            <PrioridadIndicador
              prioridad={turno.prioridad}
              examen={turno.examen ?? undefined}
              variante="fila"
            />
          )}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <Link
          href={href}
          scroll={false}
          onClick={(e) => {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) marcarAbiertoConLink()
          }}
          className="focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {turno.alumno.apellido}, {turno.alumno.nombre}
        </Link>
      </TableCell>
      {columnas.profesor && (
        <TableCell className="text-muted-foreground">
          {turno.profesor && `${turno.profesor.apellido}, ${turno.profesor.nombre}`}
        </TableCell>
      )}
      <TableCell className="text-muted-foreground">{turno.materia.nombre}</TableCell>
      <TableCell className="text-muted-foreground">{turno.aula.nombre}</TableCell>
      <TableCell>
        <EstadoTurnoBadge estado={turno.estado} />
      </TableCell>
      {columnas.pago && (
        <TableCell>
          {/* Una cancelada nunca se cobró (la API manda PENDIENTE): "Pendiente" confundiría. */}
          {turno.estado === 'CANCELADO' ? (
            <span className="text-muted-foreground" aria-label="Sin pago: turno cancelado">
              —
            </span>
          ) : (
            <EstadoPagoBadge estado={turno.estadoPago} />
          )}
        </TableCell>
      )}
    </TableRow>
  )
}
