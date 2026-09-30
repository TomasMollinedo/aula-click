// Importes en pesos para mostrar en la UI (precio por hora de una materia, importes de pagos). La
// API manda los importes como número JSON con hasta dos decimales (decisión T-57); acá solo se les
// da formato. Vive en utils/ para que cualquier feature lo use sin importar de otra.

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Importe en pesos con dos decimales y separadores de es-AR: `7500` → "$ 7.500,00". Entre el `$`
 * y el número Intl pone un espacio duro (U+00A0), para que no se corte en dos líneas.
 */
export function formatearPesos(importe: number): string {
  return PESOS.format(importe)
}
