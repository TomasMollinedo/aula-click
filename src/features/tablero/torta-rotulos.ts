// Dónde van los rótulos que rodean la torta de asistencia (HU-39). Es sólo geometría: qué lado de la
// torta le toca a cada parte y a qué altura, para que cada rótulo quede junto a su porción y dos
// rótulos del mismo lado no se pisen. Los números los calcula la API; acá sólo se reparte el lugar.

export type RotuloDeTorta = {
  /** La posición de la parte en la lista de valores que se le pasó. */
  indice: number
  lado: 'izquierda' | 'derecha'
  /** Altura del rótulo respecto del centro de la torta, en píxeles (negativa = arriba). */
  y: number
  /** El punto de la porción más cercano al rótulo, respecto del centro, en píxeles. */
  borde: { x: number; y: number }
}

/** Radio exterior de la torta, en píxeles: de ahí sale la línea que une la porción con su rótulo. */
export const RADIO_TORTA = 78

/**
 * Reparte los rótulos de las partes con valor mayor a 0 (las demás no tienen porción y no llevan
 * rótulo). Las partes se dibujan en orden, en el sentido de las agujas del reloj desde arriba. Cada
 * rótulo va del lado donde cae el centro de su porción, a la altura de ese punto; si dos del mismo
 * lado quedan a menos de `altoRotulo`, se separan y se vuelve a centrar el grupo. `alto` es lo que
 * tiene que medir el contenedor para que entren todos.
 */
export function rotulosDeTorta(
  valores: readonly number[],
  { altoRotulo = 76, alcance = 64 }: { altoRotulo?: number; alcance?: number } = {},
): { rotulos: RotuloDeTorta[]; alto: number } {
  const total = valores.reduce((suma, valor) => suma + valor, 0)
  if (total <= 0) return { rotulos: [], alto: altoRotulo }

  let acumulado = 0
  const ideales = valores.flatMap((valor, indice) => {
    const medio = ((acumulado + valor / 2) / total) * 2 * Math.PI
    acumulado += valor
    if (valor <= 0) return []
    return [{ indice, medio, y: -Math.cos(medio) * alcance }]
  })

  const rotulos: RotuloDeTorta[] = []
  for (const lado of ['derecha', 'izquierda'] as const) {
    const delLado = ideales
      .filter(({ medio }) => Math.sin(medio) >= 0 === (lado === 'derecha'))
      .sort((a, b) => a.y - b.y)
    if (delLado.length === 0) continue

    const ys = delLado.map(({ y }) => y)
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + altoRotulo)
    const desfase =
      delLado.reduce((suma, { y }) => suma + y, 0) / delLado.length -
      ys.reduce((suma, y) => suma + y, 0) / ys.length

    delLado.forEach(({ indice, medio }, i) => {
      rotulos.push({
        indice,
        lado,
        y: Math.round(ys[i]! + desfase),
        borde: {
          x: Math.round(Math.sin(medio) * RADIO_TORTA),
          y: Math.round(-Math.cos(medio) * RADIO_TORTA),
        },
      })
    })
  }

  const mayor = Math.max(...rotulos.map(({ y }) => Math.abs(y)))
  return { rotulos: rotulos.sort((a, b) => a.indice - b.indice), alto: 2 * mayor + altoRotulo }
}
