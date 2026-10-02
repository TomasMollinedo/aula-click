import { anchoDeBarra, formatearCantidad, textoTurnos } from '../formato-tablero'
import { TarjetaIndicador } from './TarjetaIndicador'

export type ItemRanking = { clave: number; nombre: string; cantidad: number }

/**
 * Un top en barras horizontales ("Materias con más demanda", "Profesores con más turnos"): los
 * ítems en el orden que manda la API, cada uno con su cantidad de turnos. La barra es relativa al
 * primero (el que más tiene): es solo una ayuda visual, el número está escrito. `vacio` es el texto
 * si el período no tiene turnos.
 */
export function TarjetaRanking({
  titulo,
  rotulo,
  items,
  vacio,
}: {
  titulo: string
  rotulo: string
  items: readonly ItemRanking[]
  vacio: string
}) {
  const maximo = items.reduce((mayor, { cantidad }) => Math.max(mayor, cantidad), 0)

  return (
    <TarjetaIndicador titulo={titulo} rotulo={rotulo}>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vacio}</p>
      ) : (
        <ol className="space-y-3">
          {items.map(({ clave, nombre, cantidad }, indice) => (
            <li key={clave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground mr-2 tabular-nums">{indice + 1}.</span>
                  {nombre}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  <span aria-hidden>{formatearCantidad(cantidad)}</span>
                  <span className="sr-only">{textoTurnos(cantidad)}</span>
                </span>
              </div>
              <div aria-hidden className="bg-canvas mt-1.5 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-cobalto h-full rounded-full"
                  style={{ width: `${anchoDeBarra(cantidad, maximo)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </TarjetaIndicador>
  )
}
