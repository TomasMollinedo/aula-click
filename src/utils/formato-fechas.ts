import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

// Fechas de calendario (`YYYY-MM-DD`) como se muestran en la UI. Se leen con `parseISO` (hora
// local), nunca con `new Date('YYYY-MM-DD')` (docs/arquitectura-frontend.md → Fechas y horas).

/** `'2026-10-12'` → `'12/10'`. */
export function fechaCorta(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM')
}

/** `'2026-10-12'` → `'lunes 12/10'`. */
export function fechaConDia(fecha: string): string {
  return format(parseISO(fecha), 'EEEE dd/MM', { locale: es })
}

/** Un mes `YYYY-MM` → `'octubre de 2026'` (en un título, la mayúscula inicial va por CSS). */
export function textoMes(mes: string): string {
  return format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: es })
}
