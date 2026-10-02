import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'

import {
  ETIQUETA_PRIORIDAD,
  mostrarPrioridad,
  textoExamenCorto,
  textoExamenPrioridad,
  type ExamenPrioridad,
  type Prioridad,
  type VariantePrioridad,
} from './indicadores-turno'

// Prioridad de un turno (HU-18): franja lateral y punto de color con la palabra escrita, un canal
// visual distinto del badge de estado. No calcula nada: la prioridad y el examen (con sus días)
// vienen de la API.
//
// - `fila`: franja + punto + palabra. La franja se ubica en el borde izquierdo del ancestro
//   posicionado más cercano: la celda que lo contiene (la primera de la fila) lleva `relative`.
// - `punto`: punto + palabra, sin franja (listas compactas, el calendario).
// - `detalle`: punto + palabra + el examen escrito. Es la única variante que muestra Baja.
//
// En `fila` y `punto`, si hay examen, se lee al lado de la palabra (fecha y días que faltan) y la
// palabra es un botón con tooltip que trae el examen completo (materia incluida): se abre con el
// mouse y con el foco del teclado. El color nunca es el único canal: siempre está la palabra.

const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  ALTA: 'bg-prioridad-alta ring-1 ring-tinta/20',
  MEDIA: 'bg-prioridad-media ring-1 ring-tinta/20',
  BAJA: 'border border-muted-foreground',
}

function Marca({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', className)}>
      <span
        aria-hidden
        data-slot="prioridad-punto"
        className={cn('size-2.5 shrink-0 rounded-full', COLOR_PRIORIDAD[prioridad])}
      />
      <span>
        <span className="sr-only">Prioridad </span>
        {ETIQUETA_PRIORIDAD[prioridad]}
      </span>
    </span>
  )
}

export function PrioridadIndicador({
  prioridad,
  examen,
  variante,
  className,
}: {
  prioridad: Prioridad
  examen?: ExamenPrioridad
  variante: VariantePrioridad
  className?: string
}) {
  if (!mostrarPrioridad(prioridad, variante)) return null

  const textoExamen = examen ? textoExamenPrioridad(examen) : undefined

  if (variante === 'detalle') {
    return (
      <div data-slot="prioridad-indicador" className={cn('flex flex-col gap-0.5', className)}>
        <Marca prioridad={prioridad} className="text-sm" />
        <span className="text-muted-foreground text-sm">
          {textoExamen ?? 'Sin examen próximo en esta materia'}
        </span>
      </div>
    )
  }

  const marca = <Marca prioridad={prioridad} className="text-xs" />

  return (
    <span
      data-slot="prioridad-indicador"
      className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5', className)}
    >
      {variante === 'fila' && (
        <span
          aria-hidden
          data-slot="prioridad-franja"
          className={cn('absolute inset-y-0 left-0 w-1', COLOR_PRIORIDAD[prioridad])}
        />
      )}
      {textoExamen ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="focus-visible:ring-ring cursor-help rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {marca}
              </button>
            </TooltipTrigger>
            <TooltipContent>{textoExamen}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        marca
      )}
      {examen && (
        <span data-slot="prioridad-examen" className="text-muted-foreground text-xs">
          {textoExamenCorto(examen)}
        </span>
      )}
    </span>
  )
}
