'use client'

import { useId } from 'react'
import Link from 'next/link'
import { ChevronDown, UserRound } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { cn } from '@/utils/cn'

import type { CalendarioItem } from '../agendas.types'
import {
  cantidadCancelados,
  type ClaseCalendario,
  disponibilidadDeClase,
  type NivelDeCupo,
  textoDisponibilidad,
} from '../calendario'
import { useDetalleAgenda } from '../hooks/use-detalle-agenda'

// Cómo se ve la disponibilidad de la clase: el color de la palabra y el de la barra. La palabra
// siempre está escrita: el color nunca es el único canal.
const ESTILO_CUPO: Record<NivelDeCupo, { texto: string; barra: string }> = {
  llena: { texto: 'text-cancelado', barra: 'bg-cancelado' },
  ultimo: { texto: 'text-urgente', barra: 'bg-urgente' },
  libre: { texto: 'text-confirmado', barra: 'bg-confirmado' },
}

type BloqueClaseProps = {
  clase: ClaseCalendario
  expandida: boolean
  onAlternar: () => void
  /** La agenda del centro muestra el profesor de cada clase; las de un solo profesor, no. */
  mostrarProfesor: boolean
  /** La clase es de un día anterior a hoy: se ve atenuada porque ya no tiene relevancia. */
  esPasada: boolean
}

/**
 * Una clase en el calendario (HU-19): un único bloque por hora de un bloque del horario, con sus
 * alumnos adentro. Contraído es un resumen: horario, materia, profesor y aula en una sola línea
 * (según el origen) y cómo viene el cupo ("3/4 alumnos", cuántos lugares quedan o si está llena).
 * Un clic lo expande y muestra cada turno con su propio estado y su prioridad, porque la clase no
 * tiene un estado ni una prioridad comunes. Un clic en un alumno abre el detalle de su turno
 * (`?detalle=&fecha=`). El cupo es el de la clase entera, lo calcula la API y no cambia con los
 * filtros: los turnos visibles pueden ser menos que los ocupados.
 */
export function BloqueClase({
  clase,
  expandida,
  onAlternar,
  mostrarProfesor,
  esPasada,
}: BloqueClaseProps) {
  const idPanel = useId()
  const cantidad = clase.turnos.length
  const cancelados = cantidadCancelados(clase)
  const todosCancelados = cancelados === cantidad
  const materias = clase.materias.map((materia) => materia.nombre).join(' · ')
  const disponibilidad = disponibilidadDeClase(clase.cupo)
  const estiloCupo = ESTILO_CUPO[disponibilidad.nivel]
  const ocupacion = Math.min(clase.cupo.ocupados / Math.max(clase.cupo.capacidad, 1), 1)

  return (
    <div
      data-slot="bloque-clase"
      className={cn(
        'overflow-hidden rounded-lg border-l-4 transition',
        todosCancelados
          ? 'border-cancelado/60 bg-muted'
          : expandida
            ? 'border-primary bg-card ring-primary/30 shadow-md ring-1'
            : 'border-primary bg-primary/10 hover:bg-primary/15',
        // Una clase pasada ya no importa: se atenúa, pero sigue legible y se recupera al apuntarla
        // o abrirla.
        esPasada && !expandida && 'opacity-55 focus-within:opacity-100 hover:opacity-100',
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

        {/* Profesor y aula en una sola línea: el nombre se recorta si no entra, el aula no. */}
        <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
          {mostrarProfesor && clase.profesor && (
            <>
              <UserRound aria-hidden className="size-3 shrink-0" />
              <span className="truncate">
                {clase.profesor.apellido}, {clase.profesor.nombre}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="shrink-0 font-medium">{clase.aula.nombre}</span>
        </span>

        <span className="mt-1 flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold tabular-nums">
              {clase.cupo.ocupados}/{clase.cupo.capacidad} alumnos
            </span>
            <span className={cn('font-semibold', estiloCupo.texto)}>
              {textoDisponibilidad(disponibilidad)}
            </span>
          </span>
          <span
            aria-hidden
            className="bg-foreground/10 block h-1.5 overflow-hidden rounded-full"
            data-slot="cupo-barra"
          >
            <span
              className={cn('block h-full rounded-full', estiloCupo.barra)}
              style={{ width: `${Math.round(ocupacion * 100)}%` }}
            />
          </span>
          {cancelados > 0 && (
            <span className="text-muted-foreground text-xs">
              {cancelados === 1 ? '1 turno cancelado' : `${cancelados} turnos cancelados`}
            </span>
          )}
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
