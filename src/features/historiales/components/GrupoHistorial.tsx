import { Card } from '@/components/ui/card'

import { tituloGrupo } from '../formato-historiales'
import type { GrupoDelHistorial, ResumenDelHistorial } from '../historiales.types'
import { BloqueHistorial } from './BloqueHistorial'

/** Un número del resumen con su rótulo. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium">{etiqueta}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}

/**
 * El resumen del grupo, tal como lo manda la API: clases realizadas, ausencias y porcentaje de
 * asistencia. El porcentaje **no se calcula acá** (realizadas sobre realizadas más ausencias, sin
 * contar cancelados ni sin registrar: lo decide la API, HU-31).
 */
function Resumen({ resumen }: { resumen: ResumenDelHistorial }) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      <Dato etiqueta="Clases realizadas" valor={String(resumen.realizadas)} />
      <Dato etiqueta="Ausencias" valor={String(resumen.ausencias)} />
      <Dato etiqueta="Asistencia" valor={`${resumen.porcentaje} %`} />
    </dl>
  )
}

type GrupoHistorialProps = {
  grupo: GrupoDelHistorial
  /** `id` del título, para el `aria-labelledby` de la sección. */
  id: string
  hrefDetalle: (turnoId: number, fecha: string) => string
  onAbrirDetalle: () => void
}

/**
 * Una sección del historial: una **materia con un profesor** ("Matemática — Prof. Pérez"), con su
 * resumen arriba y debajo sus bloques de horas seguidas, de la fecha más reciente a la más antigua
 * (el orden que manda la API; acá no se reordena nada).
 */
export function GrupoHistorial({ grupo, id, hrefDetalle, onAbrirDetalle }: GrupoHistorialProps) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <header className="space-y-3">
          <h3 id={id} className="text-base font-semibold">
            {tituloGrupo(grupo)}
          </h3>
          <Resumen resumen={grupo.resumen} />
        </header>

        <div className="space-y-3">
          {grupo.bloques.map((bloque) => (
            <BloqueHistorial
              key={`${bloque.fecha}-${bloque.horaInicio}`}
              bloque={bloque}
              hrefDetalle={hrefDetalle}
              onAbrirDetalle={onAbrirDetalle}
            />
          ))}
        </div>
      </Card>
    </section>
  )
}
