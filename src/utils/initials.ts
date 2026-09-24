/**
 * Iniciales para un avatar: la primera letra de cada parte no vacía, en mayúsculas y hasta dos
 * (`getInitials('Camila', 'Ríos')` → `'CR'`). Sin partes con texto devuelve `''`.
 */
export function getInitials(...parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
