import { anchoDeBarra, formatearCantidad, textoTurnos } from '../formato-tablero'
import type { MateriaConDemanda } from '../tablero.types'
import { TarjetaIndicador } from './TarjetaIndicador'

/**
 * "Materias con más demanda": hasta 5, con su cantidad de turnos no cancelados, en el orden que
 * manda la API. La barra es relativa a la primera (la de más turnos): es solo una ayuda visual, el
 * número está escrito. Vacío si el período no tiene turnos.
 */
export function TarjetaMaterias({
  materias,
  rotulo,
}: {
  materias: readonly MateriaConDemanda[]
  rotulo: string
}) {
  const maximo = materias.reduce((mayor, { cantidad }) => Math.max(mayor, cantidad), 0)

  return (
    <TarjetaIndicador titulo="Materias con más demanda" rotulo={rotulo}>
      {materias.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay turnos en este período.</p>
      ) : (
        <ol className="space-y-3">
          {materias.map(({ materia, cantidad }, indice) => (
            <li key={materia.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground mr-2 tabular-nums">{indice + 1}.</span>
                  {materia.nombre}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  <span aria-hidden>{formatearCantidad(cantidad)}</span>
                  <span className="sr-only">{textoTurnos(cantidad)}</span>
                </span>
              </div>
              <div aria-hidden className="bg-canvas mt-1.5 h-1.5 overflow-hidden rounded-full">
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
