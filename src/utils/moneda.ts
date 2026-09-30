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

export type SumaDeImportes = {
  /** La suma, o `null` si alguno no tiene importe. */
  total: number | null
  /** Cuántos vienen sin importe (`null`). */
  sinPrecio: number
}

/**
 * Suma importes en pesos que ya mandó la API (por ejemplo, el resumen de lo que se va a cobrar).
 * La cuenta va en centavos, para no acumular el error de coma flotante (`0.1 + 0.2` → `0.3`). Si
 * alguno es `null` (una materia sin precio) no hay total: no se muestra una suma parcial como si
 * fuera la real.
 */
export function sumarImportes(importes: readonly (number | null)[]): SumaDeImportes {
  let centavos = 0
  let sinPrecio = 0
  for (const importe of importes) {
    if (importe === null) sinPrecio++
    else centavos += Math.round(importe * 100)
  }
  return { total: sinPrecio > 0 ? null : centavos / 100, sinPrecio }
}
