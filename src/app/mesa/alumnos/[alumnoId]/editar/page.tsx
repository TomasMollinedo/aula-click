import { AlumnosPantalla } from '@/features/alumnos/components/AlumnosPantalla'

// Edición entrando por URL: el listado de fondo; el modal lo pone @modal/[alumnoId]/editar.
export default function EditarAlumnoPage() {
  return <AlumnosPantalla rutaBase="/mesa/alumnos" />
}
