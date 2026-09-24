import { ProfesoresPantalla } from '@/features/profesores/components/ProfesoresPantalla'

// Alta entrando por URL: el listado de fondo; el modal lo pone @modal/nuevo.
export default function NuevoProfesorPage() {
  return <ProfesoresPantalla rutaBase="/mesa/profesores" />
}
