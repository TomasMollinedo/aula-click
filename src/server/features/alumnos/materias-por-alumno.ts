import type { AlumnoMateria } from './alumnos.validation'

// Función pura: agrupa turnos por alumno y arma la lista de materias de cada uno, sin repetir,
// en el orden en que llegan (ya vienen ordenadas por nombre desde la consulta). La usa
// `alumnos.repository` para `GET /alumnos/mis-alumnos`.

/** Un turno, para lo único que necesita esta función: de quién es y de qué materia. */
export type TurnoConMateria = { alumnoId: number; materia: AlumnoMateria }

export function agruparMateriasPorAlumno(turnos: TurnoConMateria[]): Map<number, AlumnoMateria[]> {
  const materiasPorAlumno = new Map<number, AlumnoMateria[]>()
  for (const turno of turnos) {
    const materias = materiasPorAlumno.get(turno.alumnoId) ?? []
    if (!materias.some((materia) => materia.id === turno.materia.id)) materias.push(turno.materia)
    materiasPorAlumno.set(turno.alumnoId, materias)
  }
  return materiasPorAlumno
}
