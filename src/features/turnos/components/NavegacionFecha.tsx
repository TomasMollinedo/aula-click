'use client'

import { getISODay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { nombreDiaSemana } from '@/utils/dias-semana'

type NavegacionFechaProps = {
  /** `YYYY-MM-DD`. */
  fecha: string
  esHoy: boolean
  onAnterior: () => void
  onSiguiente: () => void
  onHoy: () => void
  /** Elegir una fecha directamente (filtro de fecha), en vez de ir día por día. */
  onCambiarFecha: (fecha: string) => void
}

export function NavegacionFecha({
  fecha,
  esHoy,
  onAnterior,
  onSiguiente,
  onHoy,
  onCambiarFecha,
}: NavegacionFechaProps) {
  const nombreDia = nombreDiaSemana(getISODay(parseISO(fecha)))

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onAnterior} aria-label="Día anterior">
        <ChevronLeft className="size-4" />
      </Button>

      <span className="text-sm font-medium whitespace-nowrap">{nombreDia}</span>
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
      <Button variant="outline" size="sm" onClick={onHoy} disabled={esHoy}>
        Hoy
      </Button>

      <Button variant="outline" size="icon" onClick={onSiguiente} aria-label="Día siguiente">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
