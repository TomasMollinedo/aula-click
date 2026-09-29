'use client'

import { getISODay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { nombreDiaSemana } from '@/utils/dias-semana'

/**
 * Textos de la navegación. Por defecto son los de una vista por día (la agenda diaria del centro);
 * la agenda propia del profesor (HU-10) los cambia cuando muestra una semana.
 */
type TextosNavegacion = {
  /** A la izquierda del selector. Por defecto, el nombre del día de `fecha`. */
  etiqueta?: string
  anterior?: string
  siguiente?: string
  /** Botón que vuelve al rango de hoy. */
  actual?: string
}

type NavegacionFechaProps = {
  /** `YYYY-MM-DD`. En una vista por semana, el primer día del rango. */
  fecha: string
  /** El rango que se está viendo es el de hoy: el botón de volver a él queda deshabilitado. */
  esActual: boolean
  onAnterior: () => void
  onSiguiente: () => void
  onActual: () => void
  /** Elegir una fecha directamente (filtro de fecha), en vez de ir de a un paso. */
  onCambiarFecha: (fecha: string) => void
  textos?: TextosNavegacion
}

export function NavegacionFecha({
  fecha,
  esActual,
  onAnterior,
  onSiguiente,
  onActual,
  onCambiarFecha,
  textos,
}: NavegacionFechaProps) {
  const etiqueta = textos?.etiqueta ?? nombreDiaSemana(getISODay(parseISO(fecha)))

  // `flex-wrap`: la etiqueta de una semana ("Semana del 28/09 al 04/10") es bastante más larga
  // que el nombre de un día, así que en pantallas angostas envuelve en vez de desbordar.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onAnterior}
        aria-label={textos?.anterior ?? 'Día anterior'}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <span className="text-sm font-medium whitespace-nowrap">{etiqueta}</span>
      <span className="text-muted-foreground">-</span>
      <Input
        type="date"
        value={fecha}
        onChange={(e) => {
          // El navegador manda "" mientras se borra el campo a mano: se ignora hasta que vuelva
          // a ser una fecha completa.
          if (e.target.value) onCambiarFecha(e.target.value)
        }}
        aria-label="Elegir fecha"
        className="h-9 w-40 font-semibold"
      />
      <span className="text-muted-foreground">-</span>
      <Button variant="outline" size="sm" onClick={onActual} disabled={esActual}>
        {textos?.actual ?? 'Hoy'}
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={onSiguiente}
        aria-label={textos?.siguiente ?? 'Día siguiente'}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
