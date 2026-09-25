'use client'

import { format, getISODay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { nombreDiaSemana } from '@/utils/dias-semana'

type NavegacionFechaProps = {
  /** `YYYY-MM-DD`. */
  fecha: string
  esHoy: boolean
  onAnterior: () => void
  onSiguiente: () => void
  onHoy: () => void
}

export function NavegacionFecha({
  fecha,
  esHoy,
  onAnterior,
  onSiguiente,
  onHoy,
}: NavegacionFechaProps) {
  const fechaParseada = parseISO(fecha)
  const etiqueta = `${nombreDiaSemana(getISODay(fechaParseada))} ${format(fechaParseada, 'dd/MM/yyyy')}`

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onAnterior} aria-label="Día anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-44 text-center">
        <p className="font-semibold">{etiqueta}</p>
        {esHoy && <p className="text-muted-foreground text-xs">Hoy</p>}
      </div>
      <Button variant="outline" size="icon" onClick={onSiguiente} aria-label="Día siguiente">
        <ChevronRight className="size-4" />
      </Button>
      {!esHoy && (
        <Button variant="outline" size="sm" onClick={onHoy}>
          Hoy
        </Button>
      )}
    </div>
  )
}
