import { MateriasPantalla } from '@/features/materias/components/MateriasPantalla'

// Alta entrando por URL: el listado de fondo; el modal lo pone @modal/nueva.
export default function NuevaMateriaPage() {
  return <MateriasPantalla rutaBase="/mesa/materias" rutaProfesores="/mesa/profesores" />
}
