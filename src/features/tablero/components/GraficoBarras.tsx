'use client'

import { useState } from 'react'

import { cn } from '@/utils/cn'

import { escalaDelEje } from '../escala-grafico'

export type SerieBarras = {
  etiqueta: string
  /** Clase de `fill-*` con el color de la columna (un token de la paleta). */
  claseRelleno: string
  /** Clase de `bg-*` con el mismo color, para el punto de la leyenda y del globo. */
  claseFondo: string
}

export type GrupoBarras = {
  /** Identifica al grupo: con ella se dice cuál está elegido y cuál se clickeó. */
  clave: string
  /** Lo que se escribe debajo del grupo, en el eje (corto: entra una vez por grupo). */
  etiqueta: string
  /** Cómo se nombra el grupo en el globo; por defecto, `etiqueta`. */
  titulo?: string
  /** Un valor por serie, en el mismo orden que `series`. */
  valores: readonly number[]
}

// La geometría, en unidades del viewBox. El gráfico no se estira a lo ancho de la tarjeta: queda
// entre `min-w` y `max-w` y centrado, así los textos no se agrandan ni se achican de más.
const ANCHO = 640
const ALTO = 240
/** Columna de la izquierda, donde van los números del eje (entran hasta 8 cifras). */
const X_EJE = 70
const MARGEN_DERECHO = 12
/** Aire arriba de la columna más alta. */
const PAD_SUPERIOR = 14
/** Franja de abajo, donde va la etiqueta de cada grupo. */
const ALTO_ETIQUETAS = 26
const ANCHO_COLUMNA = 18
/** Lo que mide una columna del grupo elegido: más ancha, con las de los demás opacadas. */
const ANCHO_COLUMNA_ELEGIDA = 26
/** Lo que mide una columna en 0: una marca fina sobre el eje, para que el grupo no quede vacío. */
const ALTO_EN_CERO = 2
const RADIO = 2

const X_FIN = ANCHO - MARGEN_DERECHO
const ANCHO_UTIL = X_FIN - X_EJE
const Y_BASE = ALTO - ALTO_ETIQUETAS
const ALTO_UTIL = Y_BASE - PAD_SUPERIOR

/** Una columna con las dos esquinas de arriba redondeadas y la base apoyada en el eje. */
function columna(x: number, y: number, ancho: number, alto: number): string {
  const radio = Math.min(RADIO, alto, ancho / 2)
  return [
    `M ${x} ${y + alto}`,
    `V ${y + radio}`,
    `a ${radio} ${radio} 0 0 1 ${radio} ${-radio}`,
    `H ${x + ancho - radio}`,
    `a ${radio} ${radio} 0 0 1 ${radio} ${radio}`,
    `V ${y + alto}`,
    'Z',
  ].join(' ')
}

/**
 * Columnas verticales agrupadas, en SVG puro (sin librería: agregar una dependencia se acuerda
 * aparte). Un grupo por período —en el orden en que llegan— con las columnas de sus series pegadas
 * entre sí, y el aire sólo entre grupos. **Solo dibuja:** los números ya los calculó la API, acá no
 * se suma ni se ordena nada; lo único que se calcula es la escala del eje (`escalaDelEje`), que es
 * geometría.
 *
 * Es interactivo de dos maneras, que se usan juntas: **al pasar el cursor** por un grupo se marca
 * su franja y sale un globo con el valor de cada serie, y el grupo **`elegido`** (lo decide quien
 * lo usa, por ejemplo desde una tabla) queda con las columnas más anchas y las de los demás grupos
 * opacadas. Con `onElegir`, clickear una franja elige ese grupo o lo suelta si ya estaba.
 *
 * Un valor en 0 no desaparece: deja una marca fina sobre el eje, así un período sin movimientos se
 * lee como un cero y no como un hueco.
 *
 * Accesibilidad: el color nunca es el único canal. El SVG es una sola imagen con `descripcion` para
 * el lector de pantalla y arriba va la leyenda con el nombre de cada serie; quien lo usa muestra
 * además los números en una tabla, que es también el camino con teclado para elegir un grupo (acá
 * las franjas son del mouse). En pantallas chicas el gráfico se desplaza dentro de su contenedor,
 * como las tablas.
 */
export function GraficoBarras({
  series,
  grupos,
  descripcion,
  formatearValor,
  formatearEje = formatearValor,
  elegido = null,
  onElegir,
  className,
}: {
  series: readonly SerieBarras[]
  grupos: readonly GrupoBarras[]
  descripcion: string
  /** Cómo se escribe un valor en el globo. */
  formatearValor: (valor: number) => string
  /** Cómo se escriben los números del eje; por defecto, como los del globo. */
  formatearEje?: (valor: number) => string
  /** La `clave` del grupo resaltado, o `null`: sus columnas se agrandan y las demás se opacan. */
  elegido?: string | null
  /** Si se puede elegir un grupo clickeando su franja (la misma clave vuelve a soltarlo). */
  onElegir?: (clave: string) => void
  className?: string
}) {
  const [encima, setEncima] = useState<string | null>(null)

  const maximo = Math.max(0, ...grupos.flatMap(({ valores }) => [...valores]))
  const { tope, valores: lineas } = escalaDelEje(maximo)
  const anchoGrupo = grupos.length > 0 ? ANCHO_UTIL / grupos.length : ANCHO_UTIL
  const indiceEncima = grupos.findIndex(({ clave }) => clave === encima)
  const grupoEncima = indiceEncima >= 0 ? grupos[indiceEncima] : undefined
  const hayElegido = grupos.some(({ clave }) => clave === elegido)

  const centroDe = (indice: number) => X_EJE + (indice + 0.5) * anchoGrupo
  const altoDe = (valor: number) =>
    tope > 0 && valor > 0 ? Math.max((valor / tope) * ALTO_UTIL, ALTO_EN_CERO) : ALTO_EN_CERO

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="mx-auto w-full max-w-[820px] min-w-[480px] space-y-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map(({ etiqueta, claseFondo }) => (
            <li key={etiqueta} className="flex items-center gap-2 text-xs">
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', claseFondo)} />
              <span>{etiqueta}</span>
            </li>
          ))}
        </ul>

        <div className="relative">
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            style={{ aspectRatio: `${ANCHO} / ${ALTO}` }}
            role="img"
            aria-label={descripcion}
            className="block w-full"
            onMouseLeave={() => setEncima(null)}
          >
            {/* La franja del grupo que se está mirando o que está elegido, detrás de todo. */}
            {grupos.map(({ clave }, indice) =>
              clave === encima || clave === elegido ? (
                <rect
                  key={clave}
                  x={centroDe(indice) - anchoGrupo / 2}
                  y={PAD_SUPERIOR - 6}
                  width={anchoGrupo}
                  height={ALTO_UTIL + 6}
                  rx={4}
                  className={clave === elegido ? 'fill-cobalto/10' : 'fill-canvas'}
                />
              ) : null,
            )}

            {/* La grilla: el cero bien marcado y el resto en gris suave. */}
            {lineas.map((valor) => {
              const y = Y_BASE - (tope > 0 ? (valor / tope) * ALTO_UTIL : 0)
              return (
                <g key={valor}>
                  <line
                    x1={X_EJE}
                    y1={y}
                    x2={X_FIN}
                    y2={y}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                    className={valor === 0 ? 'stroke-border' : 'stroke-border/50'}
                  />
                  <text
                    x={X_EJE - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={10}
                    className="fill-muted-foreground"
                  >
                    {formatearEje(valor)}
                  </text>
                </g>
              )
            })}
            {/* Sin escala (todo en 0) la grilla no se dibuja: queda sólo la línea del cero. */}
            {lineas.length === 0 && (
              <line
                x1={X_EJE}
                y1={Y_BASE}
                x2={X_FIN}
                y2={Y_BASE}
                strokeWidth={1}
                shapeRendering="crispEdges"
                className="stroke-border"
              />
            )}

            {grupos.map((grupo, indiceGrupo) => {
              const esElegido = grupo.clave === elegido
              const ancho = esElegido ? ANCHO_COLUMNA_ELEGIDA : ANCHO_COLUMNA
              const x = centroDe(indiceGrupo) - (series.length * ancho) / 2
              return (
                <g key={grupo.clave}>
                  {series.map(({ etiqueta, claseRelleno }, indiceSerie) => {
                    const valor = grupo.valores[indiceSerie] ?? 0
                    const alto = altoDe(valor)
                    return (
                      <path
                        key={etiqueta}
                        d={columna(x + indiceSerie * ancho, Y_BASE - alto, ancho, alto)}
                        className={cn(
                          claseRelleno,
                          // Una sola clase de opacidad, para que no se pisen entre sí: con un grupo
                          // elegido los demás pasan a segundo plano, y una columna en 0 es la marca.
                          hayElegido && !esElegido
                            ? 'opacity-25'
                            : valor <= 0
                              ? 'opacity-35'
                              : undefined,
                        )}
                      />
                    )
                  })}
                  <text
                    x={centroDe(indiceGrupo)}
                    y={Y_BASE + 17}
                    textAnchor="middle"
                    fontSize={11}
                    className={
                      esElegido ? 'fill-foreground font-semibold' : 'fill-muted-foreground'
                    }
                  >
                    {grupo.etiqueta}
                  </text>
                </g>
              )
            })}

            {/* Encima de todo, la zona sensible de cada grupo: entera, no sólo sus columnas. */}
            {grupos.map((grupo, indice) => (
              <rect
                key={grupo.clave}
                x={centroDe(indice) - anchoGrupo / 2}
                y={PAD_SUPERIOR - 6}
                width={anchoGrupo}
                height={ALTO_UTIL + 6 + ALTO_ETIQUETAS}
                fill="transparent"
                className={onElegir ? 'cursor-pointer' : undefined}
                onMouseEnter={() => setEncima(grupo.clave)}
                onClick={onElegir ? () => onElegir(grupo.clave) : undefined}
              />
            ))}
          </svg>

          {/* El globo, del lado contrario al grupo que se mira, para no taparle las columnas. */}
          {grupoEncima && (
            <div
              className={cn(
                'bg-background border-border pointer-events-none absolute top-0 rounded-lg border p-3 text-xs shadow-md',
                indiceEncima < grupos.length / 2 ? 'right-0' : 'left-0',
              )}
            >
              <p className="font-semibold">{grupoEncima.titulo ?? grupoEncima.etiqueta}</p>
              <ul className="mt-1.5 space-y-1">
                {series.map(({ etiqueta, claseFondo }, indiceSerie) => (
                  <li key={etiqueta} className="flex items-center gap-2 whitespace-nowrap">
                    <span aria-hidden className={cn('size-2 shrink-0 rounded-full', claseFondo)} />
                    <span className="text-muted-foreground">{etiqueta}</span>
                    <span className="ml-auto pl-3 font-semibold tabular-nums">
                      {formatearValor(grupoEncima.valores[indiceSerie] ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
