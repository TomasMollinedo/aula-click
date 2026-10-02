'use client'

import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { Field, fieldErrorId } from '@/components/ui/field'
import { cn } from '@/utils/cn'

import {
  ETIQUETA_OPCION,
  OPCIONES_PERIODO,
  type OpcionPeriodo,
  type PeriodoElegido,
} from '../periodo'

/**
 * El selector de período del tablero: "Hoy", "Esta semana", "Este mes" o "Personalizado" (dos
 * fechas). No guarda estado: muestra el de la URL y avisa cada cambio, que se aplica enseguida. No
 * valida el rango: un "Hasta" anterior al "Desde" se manda igual y el error de la API sale junto al
 * campo (`errores`).
 */
export function SelectorPeriodo({
  periodo,
  onElegir,
  onCambiarRango,
  errores = {},
}: {
  periodo: PeriodoElegido
  onElegir: (opcion: OpcionPeriodo) => void
  onCambiarRango: (cambios: { desde?: string; hasta?: string }) => void
  /** El 400 de la API sobre cada extremo (`interpretarErrorTablero`). */
  errores?: { desde?: string; hasta?: string }
}) {
  const id = useId()
  const ids = { desde: `${id}-desde`, hasta: `${id}-hasta` }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
        {OPCIONES_PERIODO.map((opcion) => {
          const activa = periodo.opcion === opcion
          return (
            <Button
              key={opcion}
              type="button"
              size="sm"
              variant={activa ? 'default' : 'outline'}
              aria-pressed={activa}
              className={cn(!activa && 'text-foreground')}
              onClick={() => onElegir(opcion)}
            >
              {ETIQUETA_OPCION[opcion]}
            </Button>
          )
        })}
      </div>

      {periodo.opcion === 'rango' && (
        <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
          <Field label="Desde" htmlFor={ids.desde} error={errores.desde}>
            <CalendarioFecha
              id={ids.desde}
              compacto
              value={periodo.desde}
              onChange={(fecha) => fecha && onCambiarRango({ desde: fecha })}
              aria-invalid={errores.desde ? true : undefined}
              aria-describedby={errores.desde ? fieldErrorId(ids.desde) : undefined}
            />
          </Field>
          <Field label="Hasta" htmlFor={ids.hasta} error={errores.hasta}>
            <CalendarioFecha
              id={ids.hasta}
              compacto
              value={periodo.hasta}
              onChange={(fecha) => fecha && onCambiarRango({ hasta: fecha })}
              aria-invalid={errores.hasta ? true : undefined}
              aria-describedby={errores.hasta ? fieldErrorId(ids.hasta) : undefined}
            />
          </Field>
        </div>
      )}
    </div>
  )
}
