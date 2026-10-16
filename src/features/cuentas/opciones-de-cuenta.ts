import { coincideConBusqueda } from '@/utils/busqueda'

import type { OpcionesDeCuenta } from './cuentas.types'
import type { MateriaDeCuenta } from './hooks/use-materias-de-cuenta'

// De dónde salen las opciones de los filtros de materia y profesor de "Por cobrar" (decisión
// T-177): con un alumno (el de la ficha o el filtrado), de lo que tiene por cobrar
// (`GET /cuentas/alumnos/{alumnoId}/opciones`); sin alumno, de todas las materias y de la búsqueda
// de profesores, como siempre. Funciones puras: los filtros solo las muestran.

/**
 * Las materias del filtro: con alumno, las de sus opciones (`[]` mientras no llegan); sin alumno,
 * todas (`useMateriasDeCuenta`).
 */
export function materiasDelFiltro(
  alumnoId: number | null,
  opciones: OpcionesDeCuenta | undefined,
  todas: readonly MateriaDeCuenta[],
): readonly MateriaDeCuenta[] {
  if (alumnoId === null) return todas
  return (opciones?.materias ?? []).map((materia) => ({
    id: materia.id,
    nombre: materia.nombre,
    inactiva: materia.estado === 'INACTIVO',
  }))
}

/** Cómo se lee un profesor en el menú: "Apellido, Nombre". */
export function etiquetaProfesor(profesor: { nombre: string; apellido: string }): string {
  return `${profesor.apellido}, ${profesor.nombre}`
}

/**
 * Los profesores de las opciones del alumno cuya etiqueta tiene todas las palabras escritas, en
 * cualquier orden y sin tildes (`coincideConBusqueda`): el buscador filtra en el cliente, como el de
 * materias.
 */
export function profesoresDelFiltro(
  opciones: OpcionesDeCuenta | undefined,
  texto: string,
): { id: number; etiqueta: string }[] {
  return (opciones?.profesores ?? [])
    .map((profesor) => ({ id: profesor.id, etiqueta: etiquetaProfesor(profesor) }))
    .filter((opcion) => coincideConBusqueda(opcion.etiqueta, texto))
}
