'use client'

import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/utils/cn'

import { etiquetaOcupacion, textoHorario } from '../formato-turnos'
import type { BloqueDisponible } from '../turnos.types'

type HorasDelBloqueProps = {
  /** El bloque con la ocupación que se muestra (la del resultado o la del refresco por fecha). */
  bloque: BloqueDisponible
  tildadas: readonly number[]
  onCambio: (tildadas: number[]) => void
  /** No se puede tildar (la lista de resultados es de otros filtros, o se está guardando). */
  deshabilitado?: boolean
  /** Se está pidiendo la ocupación de otra fecha. */
  actualizando?: boolean
  /** Horas que se destildaron porque pasaron a estar completas en la fecha elegida. */
  avisos?: string[]
  /** Error de la API sobre las horas (`bloqueIds`). */
  error?: string
}

/**
 * Paso 3: las horas del bloque, cada una con su checkbox, su horario y "ocupación / capacidad"
 * tal como vienen de la API. Una hora `lleno` (lo decide la API) se muestra igual, marcada como
 * completa, y no se puede tildar. Se pueden tildar varias, consecutivas o no.
 */
export function HorasDelBloque({
  bloque,
  tildadas,
  onCambio,
  deshabilitado = false,
  actualizando = false,
  avisos = [],
  error,
}: HorasDelBloqueProps) {
  const alternar = (bloqueId: number, tildar: boolean) =>
    onCambio(tildar ? [...tildadas, bloqueId] : tildadas.filter((id) => id !== bloqueId))

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground flex items-center gap-2 text-sm" aria-live="polite">
        <CalendarDays className="size-4" aria-hidden />
        <span className="text-foreground font-medium">{etiquetaOcupacion(bloque.fecha)}</span>
        {actualizando && (
          <span className="flex items-center gap-1">
            <RefreshCw className="size-3.5 animate-spin" aria-hidden />
            Actualizando…
          </span>
        )}
      </p>

      {avisos.length > 0 && (
        <Alert>
          <AlertTriangle className="text-urgente size-4" />
          <AlertDescription>
            <p className="text-foreground">Se destildó porque está completa:</p>
            <ul className="list-disc pl-5">
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <fieldset
        aria-describedby={error ? 'horas-error' : undefined}
        className={cn(deshabilitado && 'opacity-50')}
        disabled={deshabilitado}
      >
        <legend className="sr-only">Horas del bloque</legend>
        <ul className="divide-border border-border divide-y rounded-lg border">
          {bloque.horas.map((hora) => {
            const id = `hora-${hora.bloqueId}`
            const tildada = tildadas.includes(hora.bloqueId)
            const noSePuede = hora.lleno || deshabilitado
            return (
              <li
                key={hora.bloqueId}
                className={cn('flex items-center gap-3 px-4 py-3', hora.lleno && 'bg-canvas')}
              >
                <Checkbox
                  id={id}
                  checked={tildada}
                  onCheckedChange={(v) => alternar(hora.bloqueId, v === true)}
                  disabled={noSePuede}
                  aria-disabled={noSePuede || undefined}
                  aria-describedby={hora.lleno ? `${id}-completa` : undefined}
                />
                <label
                  htmlFor={id}
                  className={cn(
                    'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm',
                    hora.lleno ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  <span className="font-medium">{textoHorario(hora.horaInicio, hora.horaFin)}</span>
                  <span className="sr-only">, </span>
                  <span className="tabular-nums">
                    {hora.ocupacion} / {hora.capacidadEfectiva}
                    <span className="sr-only"> lugares ocupados</span>
                  </span>
                </label>
                {hora.lleno && (
                  <Badge variant="cancelado" id={`${id}-completa`}>
                    Completa
                    <span className="sr-only">: no se puede elegir</span>
                  </Badge>
                )}
              </li>
            )
          })}
        </ul>
      </fieldset>

      {error && (
        <p id="horas-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
