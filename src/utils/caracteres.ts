// Qué caracteres acepta cada tipo de dato de un formulario. Lo usan los schemas de las features
// (validación) y el `Input` (`caracteres`, que descarta el resto mientras se escribe). Replican el
// formato del contrato (docs/contrato-api.md → Formatos); la validación que manda es la de la API.

export type TipoDeCaracteres = 'nombre' | 'dni' | 'telefono'

const PERMITIDO: Record<TipoDeCaracteres, RegExp> = {
  // Letras de cualquier alfabeto con sus acentos, espacio, apóstrofo (recto o tipográfico) y guion.
  nombre: /^[\p{L}\p{M} '’-]$/u,
  // Solo dígitos: la API acepta puntos y espacios, pero el formulario pide el DNI sin puntos.
  dni: /^\d$/,
  telefono: /^[\d +\-()]$/,
}

const ALGUNA_LETRA = /\p{L}/u

/** Saca los caracteres que el tipo no acepta (`filtrarCaracteres('Juan2', 'nombre')` → `'Juan'`). */
export function filtrarCaracteres(valor: string, tipo: TipoDeCaracteres): string {
  // Array.from recorre por código Unicode, no por unidad UTF-16: no parte letras fuera del BMP.
  return Array.from(valor)
    .filter((caracter) => PERMITIDO[tipo].test(caracter))
    .join('')
}

/** `true` si todos los caracteres son del tipo (un texto vacío también). */
export function tieneSoloCaracteres(valor: string, tipo: TipoDeCaracteres): boolean {
  return filtrarCaracteres(valor, tipo) === valor
}

/** `true` si tiene al menos una letra: un nombre no puede ser solo espacios, guiones o apóstrofos. */
export function tieneAlgunaLetra(valor: string): boolean {
  return ALGUNA_LETRA.test(valor)
}
