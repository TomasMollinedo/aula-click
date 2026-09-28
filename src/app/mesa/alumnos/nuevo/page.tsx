import { AlumnosPantalla } from '@/features/alumnos/components/AlumnosPantalla'

// Alta entrando por URL: el listado de fondo; el modal lo pone @modal/nuevo.
export default function NuevoAlumnoPage() {
  return <AlumnosPantalla rutaBase="/mesa/alumnos" />
}
