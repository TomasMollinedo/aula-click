import Link from 'next/link'
import { Ban, ChevronRight, MessageSquareWarning } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { rangoHoras } from '@/utils/horas'

import { etiquetaMotivoCancelacion, tituloBloque } from '../formato-historiales'
import type {
  BloqueDelHistorial,
  ClaseDelHistorial,
  TextosDelHistorial,
} from '../historiales.types'

/** "Qué se trabajó" e indicaciones, del bloque (una sola vez) o propios de una hora. */
function Textos({ textos, propios = false }: { textos: TextosDelHistorial; propios?: boolean }) {
  if (textos.trabajado === null && textos.indicaciones === null) return null
  return (
    <dl className="space-y-2 text-sm">
      {textos.trabajado !== null && (
        <div>
          <dt className="text-muted-foreground text-xs font-medium">
            {propios ? 'Qué se trabajó en esta hora' : 'Qué se trabajó'}
          </dt>
          <dd className="whitespace-pre-line">{textos.trabajado}</dd>
        </div>
      )}
      {textos.indicaciones !== null && (
        <div>
          <dt className="text-muted-foreground text-xs font-medium">
            {propios ? 'Indicaciones de esta hora' : 'Indicaciones para la próxima sesión'}
          </dt>
          <dd className="whitespace-pre-line">{textos.indicaciones}</dd>
        </div>
      )}
    </dl>
  )
}

type ClaseProps = {
  clase: ClaseDelHistorial
  /** A dónde lleva el clic: el detalle del turno (`?detalle=&fecha=`). */
  href: string
  onAbrir: () => void
}

/**
 * Una clase: **una hora**, con su estado (y su plazo o el cierre del sistema, que decide el badge),
 * la observación de la ausencia o del cierre, el motivo de un cancelado y, sólo si difieren de los
 * del bloque, sus propios textos. Todo el renglón es un enlace al detalle del turno.
 */
function Clase({ clase, href, onAbrir }: ClaseProps) {
  return (
    <li>
      <Link
        href={href}
        onClick={onAbrir}
        scroll={false}
        className="focus-visible:ring-ring hover:bg-canvas flex items-start gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-6"
      >
        <span className="min-w-0 flex-1 space-y-2">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium tabular-nums">
              {rangoHoras(clase.horaInicio, clase.horaFin)}
            </span>
            <EstadoTurnoBadge estado={clase.estado} plazo={clase.plazoAsistencia} />
          </span>

          {clase.cancelacion && (
            <span className="text-muted-foreground flex items-start gap-2 text-sm">
              <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {etiquetaMotivoCancelacion(clase.cancelacion.motivo)}
                {clase.cancelacion.detalle !== null && `: ${clase.cancelacion.detalle}`}
              </span>
            </span>
          )}

          {clase.observacion !== null && (
            <span className="text-muted-foreground flex items-start gap-2 text-sm">
              <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="whitespace-pre-line">{clase.observacion}</span>
            </span>
          )}

          {clase.textosPropios && (
            <span className="border-border block border-l-2 pl-3">
              <Textos textos={clase.textosPropios} propios />
            </span>
          )}
        </span>
        <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="sr-only">Ver el detalle del turno</span>
      </Link>
    </li>
  )
}

type BloqueHistorialProps = {
  bloque: BloqueDelHistorial
  hrefDetalle: (turnoId: number, fecha: string) => string
  onAbrirDetalle: () => void
}

/**
 * Un bloque de **horas seguidas** (HU-31, ajuste del 14/10): su fecha y horario con la cantidad de
 * horas, "Qué se trabajó" e indicaciones **una sola vez** (los `textos` que manda la API) y debajo
 * una fila por hora. La pantalla no compara textos ni agrupa nada: los bloques, sus textos y el
 * estado de cada hora los decide la API.
 */
export function BloqueHistorial({ bloque, hrefDetalle, onAbrirDetalle }: BloqueHistorialProps) {
  return (
    <section className="border-border rounded-lg border">
      <h4 className="px-4 pt-3 text-sm font-semibold capitalize sm:px-6">{tituloBloque(bloque)}</h4>

      {bloque.textos && (
        <div className="px-4 pt-3 sm:px-6">
          <Textos textos={bloque.textos} />
        </div>
      )}

      <ul className="divide-border mt-3 divide-y border-t">
        {bloque.clases.map((clase) => (
          <Clase
            key={`${clase.turnoId}-${clase.fecha}-${clase.horaInicio}`}
            clase={clase}
            href={hrefDetalle(clase.turnoId, clase.fecha)}
            onAbrir={onAbrirDetalle}
          />
        ))}
      </ul>
    </section>
  )
}
