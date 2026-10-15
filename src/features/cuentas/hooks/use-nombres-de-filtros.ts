import { useAlumno } from '@/features/alumnos/hooks/use-alumno'
import { useProfesor } from '@/features/profesores/hooks/use-profesor'

import type { FilaDeCuenta } from '../a-cobrar'
import type { FiltrosGlobal } from '../filtros-cuenta'
import { textoMaterias } from '../formato-cuentas'
import { useMateriasDeCuenta } from './use-materias-de-cuenta'

export type NombresDeFiltros = {
  /** `'Lucía Álvarez'`, o `null` sin ese filtro o mientras carga. Lo mismo el profesor. */
  alumno: string | null
  /** Las materias elegidas en una frase (`'Inglés y Matemática'`), o `null` sin ese filtro. */
  materia: string | null
  /**
   * Cada materia elegida con su nombre, en el orden del filtro (`nombre: null` mientras carga):
   * para el control, que muestra también las que no están en la lista.
   */
  materias: { id: number; nombre: string | null }[]
  profesor: string | null
}

/**
 * El nombre de lo que está filtrado (los filtros de la URL son ids), para la línea de filtros
 * activos del total y para los controles. Sale de los hooks de cada feature, que ya cachean; si
 * todavía no llegó o no está, de las filas que se ven (traen su materia y su profesor); y si
 * tampoco, un texto genérico, para que el filtro activo nunca quede sin nombrar.
 */
export function useNombresDeFiltros(
  filtros: Partial<FiltrosGlobal>,
  filas: readonly FilaDeCuenta[],
): NombresDeFiltros {
  const { alumnoId = null, materiaIds = [], profesorId = null } = filtros
  const alumnoQuery = useAlumno(alumnoId ?? 0)
  const profesorQuery = useProfesor(profesorId ?? 0)
  const materiasQuery = useMateriasDeCuenta()

  const alumno =
    alumnoId !== null && alumnoQuery.data
      ? `${alumnoQuery.data.nombre} ${alumnoQuery.data.apellido}`
      : null

  const materias = materiaIds.map((id) => ({
    id,
    nombre:
      materiasQuery.materias.find((m) => m.id === id)?.nombre ??
      filas.find((fila) => fila.materia.id === id)?.materia.nombre ??
      (materiasQuery.isLoading ? null : 'Materia no disponible'),
  }))
  // Mientras falte el nombre de alguna, `null`: la línea de filtros no se muestra a medias.
  const materia = materias.every((m) => m.nombre !== null)
    ? textoMaterias(materias.map((m) => m.nombre ?? ''))
    : null

  let profesor: string | null = null
  if (profesorId !== null) {
    const deLaFila = filas.find((fila) => fila.profesor.id === profesorId)?.profesor
    const datos = profesorQuery.data ?? deLaFila
    profesor = datos
      ? `${datos.nombre} ${datos.apellido}`
      : profesorQuery.isLoading
        ? null
        : 'Profesor no disponible'
  }

  return { alumno, materia, materias, profesor }
}
