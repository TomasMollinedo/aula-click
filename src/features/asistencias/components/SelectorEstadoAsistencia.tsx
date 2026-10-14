'use client'

import { Check, UserRoundX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

import type { EstadoAsistencia } from '../asistencias.types'

const OPCIONES: { valor: EstadoAsistencia; etiqueta: string; icono: typeof Check }[] = [
  { valor: 'PRESENTE', etiqueta: 'Presente', icono: Check },
  { valor: 'AUSENTE', etiqueta: 'Ausente', icono: UserRoundX },
]

/** "Presente" / "Ausente": dos botones grandes, cómodos de tocar en el celular. */
export function SelectorEstadoAsistencia({
  value,
  onChange,
  etiqueta,
  disabled,
  invalido,
}: {
  value: EstadoAsistencia | null
  onChange: (estado: EstadoAsistencia) => void
  /** Para lectores de pantalla: de qué es el estado (el alumno, o la hora). */
  etiqueta: string
  disabled?: boolean
  invalido?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn('grid grid-cols-2 gap-2', invalido && 'ring-destructive rounded-md ring-1')}
    >
      {OPCIONES.map(({ valor, etiqueta: texto, icono: Icono }) => {
        const elegido = value === valor
        return (
          <Button
            key={valor}
            type="button"
            variant={elegido ? (valor === 'PRESENTE' ? 'confirmado' : 'cancelado') : 'outline'}
            aria-pressed={elegido}
            disabled={disabled}
            onClick={() => onChange(valor)}
            className="h-10"
          >
            <Icono aria-hidden />
            {texto}
          </Button>
        )
      })}
    </div>
  )
}
