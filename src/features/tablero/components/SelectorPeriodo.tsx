'use client'

import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { fieldErrorId } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'

import {
  ETIQUETA_OPCION,
  OPCIONES_PERIODO,
  type OpcionPeriodo,
  type PeriodoElegido,
} from '../periodo'

/**
 * El selector de período del tablero: "Hoy", "Esta semana", "Este mes" o "Personalizado" (dos
 * fechas, a la derecha de los botones, en la misma fila y con su rótulo al lado). No guarda
 * estado: muestra el de la URL y avisa cada cambio, que se aplica enseguida. No valida el rango: un "Hasta" anterior al "Desde" se manda igual y el error de la API sale junto al
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
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
          <>
            <div className="flex items-center gap-2">
              <Label htmlFor={ids.desde} className="font-semibold">
                Desde
              </Label>
              <div className="w-40">
                <CalendarioFecha
                  id={ids.desde}
                  compacto
                  value={periodo.desde}
                  onChange={(fecha) => fecha && onCambiarRango({ desde: fecha })}
                  aria-invalid={errores.desde ? true : undefined}
                  aria-describedby={errores.desde ? fieldErrorId(ids.desde) : undefined}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={ids.hasta} className="font-semibold">
                Hasta
              </Label>
              <div className="w-40">
                <CalendarioFecha
                  id={ids.hasta}
                  compacto
                  value={periodo.hasta}
                  onChange={(fecha) => fecha && onCambiarRango({ hasta: fecha })}
                  aria-invalid={errores.hasta ? true : undefined}
                  aria-describedby={errores.hasta ? fieldErrorId(ids.hasta) : undefined}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {(['desde', 'hasta'] as const).map(
        (campo) =>
          errores[campo] && (
            <p key={campo} id={fieldErrorId(ids[campo])} className="text-destructive text-xs">
              {errores[campo]}
            </p>
          ),
      )}
    </div>
  )
}
