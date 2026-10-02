import { cn } from '@/utils/cn'

export type SegmentoDona = {
  etiqueta: string
  valor: number
  /** Clase de `stroke-*` con el color del segmento (un token de la paleta). */
  claseColor: string
}

const RADIO = 46
const ANCHO_ANILLO = 14
const CIRCUNFERENCIA = 2 * Math.PI * RADIO
// Separación entre segmentos contiguos, en unidades del viewBox (el "gap" de la superficie).
const SEPARACION = 1.5

/**
 * Gráfico de torta en forma de anillo, en SVG puro (sin librería: agregar una dependencia se
 * acuerda aparte). Solo dibuja: los números ya los calculó la API. Cada segmento ocupa su parte de
 * `total` (por defecto, la suma de los valores); si `total` es mayor, el resto queda como pista
 * vacía, y si no hay nada que dibujar, solo la pista. `centro` va escrito en el medio y
 * `descripcion` es el texto para el lector de pantalla: el color nunca es el único canal, porque
 * quien lo usa pone una leyenda con los números.
 */
export function GraficoDona({
  segmentos,
  total,
  centro,
  descripcion,
  className,
}: {
  segmentos: readonly SegmentoDona[]
  total?: number
  centro: { valor: string; texto?: string }
  descripcion: string
  className?: string
}) {
  const suma = segmentos.reduce((acumulado, { valor }) => acumulado + valor, 0)
  const base = Math.max(total ?? suma, suma)
  const visibles = segmentos.filter(({ valor }) => valor > 0)

  let recorrido = 0
  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-44', className)}>
      <svg viewBox="0 0 120 120" role="img" aria-label={descripcion} className="size-full">
        <circle
          cx="60"
          cy="60"
          r={RADIO}
          fill="none"
          strokeWidth={ANCHO_ANILLO}
          className="stroke-canvas"
        />
        {base > 0 &&
          visibles.map(({ etiqueta, valor, claseColor }) => {
            const largo = (valor / base) * CIRCUNFERENCIA
            const hueco = visibles.length > 1 ? SEPARACION : 0
            const trazo = Math.max(largo - hueco, 0)
            const desfase = -recorrido
            recorrido += largo
            return (
              <circle
                key={etiqueta}
                cx="60"
                cy="60"
                r={RADIO}
                fill="none"
                strokeWidth={ANCHO_ANILLO}
                strokeDasharray={`${trazo} ${CIRCUNFERENCIA - trazo}`}
                strokeDashoffset={desfase}
                transform="rotate(-90 60 60)"
                className={claseColor}
              >
                <title>{`${etiqueta}: ${valor}`}</title>
              </circle>
            )
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold tabular-nums">{centro.valor}</span>
        {centro.texto && <span className="text-muted-foreground text-xs">{centro.texto}</span>}
      </div>
    </div>
  )
}

/** Un renglón de la leyenda de un gráfico: el color, qué es y su número. */
export function ItemLeyenda({
  claseColor,
  etiqueta,
  valor,
  detalle,
}: {
  /** Clase de `bg-*` con el mismo color del segmento. */
  claseColor: string
  etiqueta: string
  valor: string
  detalle?: string
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', claseColor)} />
        <span className="truncate">{etiqueta}</span>
      </span>
      <span className="shrink-0 tabular-nums">
        <span className="font-semibold">{valor}</span>
        {detalle && <span className="text-muted-foreground ml-1.5">{detalle}</span>}
      </span>
    </li>
  )
}
