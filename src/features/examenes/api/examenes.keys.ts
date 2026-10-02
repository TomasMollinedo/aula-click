// Todo cuelga de `all`: `useInvalidarExamenes` alcanza al listado y a las materias ofrecibles.
export const examenesKeys = {
  all: ['examenes'] as const,
  delAlumnos: () => [...examenesKeys.all, 'delAlumno'] as const,
  delAlumno: (alumnoId: number) => [...examenesKeys.delAlumnos(), alumnoId] as const,
  materias: (alumnoId: number) => [...examenesKeys.all, 'materias', alumnoId] as const,
}
