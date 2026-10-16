// La escala del eje de un gráfico de barras: hasta dónde llega y qué valores se rotulan. Funciones
// puras, como `torta-rotulos.ts`: es geometría de presentación, no una cuenta del negocio (los
// números ya los calculó la API). Vive aparte del componente para poder probarla.

export type EscalaDelEje = {
  /** El valor del tope del eje: todas las barras se miden contra él. */
  tope: number
  /** Los valores rotulados, de 0 al tope, repartidos en partes iguales. Vacío si no hay escala. */
  valores: number[]
}

/** Saca el ruido de coma flotante de una multiplicación (`0.2 * 3` → `0.6000000000000001`). */
function sinRuido(valor: number): number {
  return Number(valor.toPrecision(12))
}

/**
 * La escala que termina en un número redondo arriba del valor más alto del gráfico: el paso es 1, 2
 * o 5 por una potencia de 10, así los rótulos quedan en cifras que se leen de un vistazo (0, 50.000,
 * 100.000, 150.000) y el tope nunca queda justo en la barra más alta.
 *
 * Con `maximo` en 0 (o negativo, que no debería llegar) no hay escala: el gráfico dibuja sólo la
 * línea del cero.
 */
export function escalaDelEje(maximo: number, divisiones = 3): EscalaDelEje {
  if (!(maximo > 0) || divisiones < 1) return { tope: 0, valores: [] }
  const bruto = maximo / divisiones
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const normalizado = bruto / magnitud
  const escalon = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10
  const paso = sinRuido(escalon * magnitud)
  return {
    tope: sinRuido(paso * divisiones),
    valores: Array.from({ length: divisiones + 1 }, (_, i) => sinRuido(paso * i)),
  }
}
