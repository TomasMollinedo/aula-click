// Porcentajes para mostrar en la UI (el porcentaje del centro, el reparto de un cobro). La API los
// manda como número de 0 a 99,99 (18 = 18 %); acá solo se les da formato. Vive en utils/ para que
// cualquier feature lo use sin importar de otra.

const NUMERO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/**
 * Porcentaje con hasta dos decimales, sin ceros de más: `15` → "15 %", `15.5` → "15,5 %". Antes
 * del `%` va un espacio duro (U+00A0), como el `$` de `formatearPesos`, para que no se corte en
 * dos líneas.
 */
export function formatearPorcentaje(porcentaje: number): string {
  return `${NUMERO.format(porcentaje)} %`
}
