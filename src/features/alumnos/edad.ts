import { format } from 'date-fns'

const MAYORIA_DE_EDAD = 18
const FECHA_FORMATO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Anticipo en el formulario de la regla de la API (docs/dominio.md → Alumnos): solo decide si se
 * muestra el aviso de menor y si se piden los datos del tutor. Quien decide es la API, con su
 * propio "hoy" (hora de Salta); si no coinciden, se muestran sus 400 en los campos.
 *
 * Misma cuenta que el backend (`src/server/features/alumnos/edad.ts`, que el frontend no puede
 * importar): cumple 18 el día `(año + 18)-MM-DD` y ese día ya es mayor. Se comparan strings
 * `YYYY-MM-DD`, sin `Date`; un 29 de febrero pasa a ser mayor el 1 de marzo.
 *
 * Devuelve `null` si la fecha todavía no está completa (el aviso no se muestra).
 */
export function esMenorDeEdad(fechaNacimiento: string, hoy: string): boolean | null {
  if (!FECHA_FORMATO.test(fechaNacimiento)) return null
  const anio = Number(fechaNacimiento.slice(0, 4))
  const cumple18 = `${String(anio + MAYORIA_DE_EDAD).padStart(4, '0')}${fechaNacimiento.slice(4)}`
  return hoy < cumple18
}

/** "Hoy" del navegador como `YYYY-MM-DD` (docs/arquitectura-frontend.md → Fechas y horas). */
export function hoyLocal(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
