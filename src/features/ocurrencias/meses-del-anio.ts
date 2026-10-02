import { format } from 'date-fns'
import { es } from 'date-fns/locale/es'

// El selector de mes de "Turnos" (T-67): reemplaza el rango Desde/Hasta por un mes del año en
// curso (o "todo el año"), el mismo año que acepta el backend (T-66). Funciones puras: fechas como
// string `YYYY-MM-DD`, sin tocar el motor de ninguna otra feature.

/** Valor del selector cuando no se eligió un mes puntual. */
export const TODO_EL_ANIO = 'TODOS'

export type FiltroMes = typeof TODO_EL_ANIO | number

/** 0 (enero) a 11 (diciembre), como `Date.getMonth()`. */
export const MESES_DEL_ANIO = Array.from({ length: 12 }, (_, i) => i)

/** `0` → `'Enero'` … `11` → `'Diciembre'`. Sólo usa el mes del `Date` local: sin riesgo de huso. */
export function nombreDelMes(mes: number): string {
  const nombre = format(new Date(2000, mes, 1), 'MMMM', { locale: es })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** Primer y último día de `mes` (0-11) de `anio`, como `YYYY-MM-DD`. */
export function rangoDelMes(anio: number, mes: number): { desde: string; hasta: string } {
  const ultimoDia = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${anio}-${dosDigitos(mes + 1)}-01`,
    hasta: `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(ultimoDia)}`,
  }
}

/** 1 de enero al 31 de diciembre de `anio`. */
export function rangoDelAnio(anio: number): { desde: string; hasta: string } {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}

/** El rango a pedirle a la API según el año y el mes elegidos ("todo el año" o un mes puntual). */
export function rangoDelFiltro(anio: number, mes: FiltroMes): { desde: string; hasta: string } {
  return mes === TODO_EL_ANIO ? rangoDelAnio(anio) : rangoDelMes(anio, mes)
}
