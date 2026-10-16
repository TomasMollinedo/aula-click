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

/** El subtotal de una materia (HU-25): cuántos importes tiene y su suma (`sumarImportes`). */
export type SubtotalDeMateria = {
  materia: { id: number; nombre: string }
  cantidad: number
  /** La suma de sus importes, o `null` si alguno no tiene precio. */
  total: number | null
}

/**
 * Importes agrupados por materia, con la cantidad y el subtotal de cada una (HU-25): lo que se va
 * a cobrar, en la barra de `cuentas` y en el resumen del diálogo de `pagos`. Las materias van por
 * nombre (y por id si se repite). Los importes son los que mandó la API: solo se suman, en
 * centavos.
 */
export function subtotalesPorMateria(
  items: Iterable<{ materia: { id: number; nombre: string }; importe: number | null }>,
): SubtotalDeMateria[] {
  const grupos = new Map<
    number,
    { materia: SubtotalDeMateria['materia']; importes: (number | null)[] }
  >()
  for (const { materia, importe } of items) {
    const grupo = grupos.get(materia.id) ?? { materia, importes: [] }
    grupo.importes.push(importe)
    grupos.set(materia.id, grupo)
  }
  return [...grupos.values()]
    .map(({ materia, importes }) => ({
      materia: { id: materia.id, nombre: materia.nombre },
      cantidad: importes.length,
      total: sumarImportes(importes).total,
    }))
    .sort(
      (a, b) =>
        a.materia.nombre.localeCompare(b.materia.nombre, 'es') || a.materia.id - b.materia.id,
    )
}
