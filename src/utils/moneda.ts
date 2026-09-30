// Importes en pesos para mostrar (docs/contrato-api.md → Pagos). Solo presentación: los importes,
// el total y el vuelto los calcula la API.

/**
 * Pesos con el formato de Argentina, armado a mano para no depender del ICU del navegador:
 * `$ 32.000`, `$ 30.000,50`. Mismo algoritmo que `formatearPesos` del backend
 * (`src/server/features/pagos/pagos.reglas.ts`), que arma los mensajes de error de la API: si
 * cambia allá, se cambia acá en el mismo PR.
 */
export function formatearPesos(importe: number): string {
  const total = Math.abs(Math.round(importe * 100))
  const enteros = String(Math.floor(total / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resto = total % 100
  const signo = importe < 0 ? '-' : ''
  return `${signo}$ ${enteros}${resto === 0 ? '' : `,${String(resto).padStart(2, '0')}`}`
}
