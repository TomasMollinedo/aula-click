'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ClipboardCheck, History, Lock } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import type { EstadoOcurrencia, PlazoAsistenciaOcurrencia } from '@/types/ocurrencia'
import { cn } from '@/utils/cn'

import {
  type AsistenciaVisible,
  type HorasSeguidasVisibles,
  type TextoAsistencia,
  vistaAsistenciaHora,
  vistaHorasSeguidas,
} from '../asistencia-detalle'
import { SeccionDetalle } from './SeccionDetalle'

export type AsistenciaDelTurnoProps = {
  /** El estado de esa hora, con su plazo: el badge dice "Sin registrar · vence el …" si hace falta. */
  estado: EstadoOcurrencia
  plazo: PlazoAsistenciaOcurrencia | null
  /** La del personal (con observación y auditoría) o la del portal (sin ellas). */
  asistencia: AsistenciaVisible | null
  horasSeguidas: HorasSeguidasVisibles | null
  /** El enlace al detalle de otra hora del grupo (`hrefDetalle` de `useDetalleEnUrl`). */
  hrefHora: (turnoId: number, fecha: string) => string
  /**
   * Al final de la sección: registrar o corregir la asistencia (el detalle del profesor lo compone
   * desde `app/` con `renderRegistrarAsistencia`). El portal no lo pasa.
   */
  registro?: ReactNode
}

function Textos({ textos, className }: { textos: TextoAsistencia[]; className?: string }) {
  if (textos.length === 0) return null
  return (
    <div className={cn('space-y-0.5 text-sm', className)}>
      {textos.map(([etiqueta, texto]) => (
        <p key={etiqueta} className="break-words whitespace-pre-line">
          <span className="text-muted-foreground">{etiqueta}: </span>
          {texto}
        </p>
      ))}
    </div>
  )
}

/**
 * La sección "Asistencia" del detalle de un turno (HU-22, HU-30): la de esa hora (estado, textos u
 * observación, quién la registró y la modificó, o el cierre del sistema) y, si las tiene, sus horas
 * seguidas, con el estado de cada una y los textos una sola vez. Muestra lo que manda la API (qué
 * textos van una vez y cuáles aparte lo decide ella): no compara ni calcula nada. La usan el detalle
 * del personal y el del portal; el portal no recibe observación ni auditoría, así que no las muestra.
 */
export function AsistenciaDelTurno({
  estado,
  plazo,
  asistencia,
  horasSeguidas,
  hrefHora,
  registro,
}: AsistenciaDelTurnoProps) {
  const hora = vistaAsistenciaHora(asistencia, plazo, { conHorasSeguidas: horasSeguidas !== null })
  const grupo = horasSeguidas && vistaHorasSeguidas(horasSeguidas)

  return (
    <SeccionDetalle icon={ClipboardCheck} titulo="Asistencia">
      <div className="space-y-3">
        <EstadoTurnoBadge estado={estado} plazo={plazo} />
        {hora.cierre && (
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Lock aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
            {hora.cierre}
          </p>
        )}
        <Textos textos={hora.textos} />
        {hora.registro.length > 0 && (
          <div className="text-muted-foreground space-y-0.5 text-xs">
            {hora.registro.map((linea) => (
              <p key={linea} className="flex items-start gap-1.5">
                <History aria-hidden className="mt-px size-3.5 shrink-0" />
                {linea}
              </p>
            ))}
          </div>
        )}
      </div>

      {grupo && (
        <div className="border-border space-y-3 border-t pt-4">
          <p className="text-sm font-semibold">
            Horas seguidas{' '}
            <span className="text-muted-foreground font-normal">· {grupo.etiqueta}</span>
          </p>
          <Textos textos={grupo.textos} />
          <ul className="space-y-2">
            {grupo.horas.map((h) => {
              const fila = (
                <>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-sm font-medium tabular-nums">{h.horario}</span>
                    <EstadoTurnoBadge estado={h.estado} plazo={h.plazo} />
                    {h.actual && (
                      <span className="text-cobalto text-xs font-semibold">Esta hora</span>
                    )}
                  </span>
                  <Textos textos={h.textos} className="mt-1.5" />
                </>
              )
              return (
                <li key={`${h.turnoId}:${h.fecha}`}>
                  {h.actual ? (
                    <div
                      aria-current="true"
                      className="border-cobalto/40 bg-cobalto/5 rounded-lg border px-3 py-2"
                    >
                      {fila}
                    </div>
                  ) : (
                    <Link
                      href={hrefHora(h.turnoId, h.fecha)}
                      replace
                      scroll={false}
                      className="border-border hover:bg-muted focus-visible:ring-ring block rounded-lg border px-3 py-2 transition-colors outline-none focus-visible:ring-2"
                    >
                      {fila}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {registro}
    </SeccionDetalle>
  )
}
