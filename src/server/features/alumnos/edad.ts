const MAYORIA_DE_EDAD = 18

/**
 * Si quien nació el día `fechaNacimiento` es menor de edad el día `hoy` (ambas `YYYY-MM-DD`).
 * Cumple 18 el día `(año + 18)-MM-DD` y ese mismo día ya es mayor. Se comparan strings
 * `YYYY-MM-DD` (su orden alfabético es el cronológico): sin `Date` ni zonas horarias.
 *
 * Nacidos un 29 de febrero: cumplen 18 en un año no bisiesto (bisiesto + 18 nunca lo es), donde
 * `AAAA-02-29` no existe; como string queda entre el 28 de febrero y el 1 de marzo, así que pasan a
 * ser mayores el 1 de marzo.
 */
export function esMenorDeEdad(fechaNacimiento: string, hoy: string): boolean {
  const anio = Number(fechaNacimiento.slice(0, 4))
  const cumple18 = `${String(anio + MAYORIA_DE_EDAD).padStart(4, '0')}${fechaNacimiento.slice(4)}`
  return hoy < cumple18
}
