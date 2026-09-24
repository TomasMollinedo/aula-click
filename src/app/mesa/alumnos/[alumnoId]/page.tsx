import { AlumnosPantalla } from '@/features/alumnos/components/AlumnosPantalla'

// Detalle entrando por URL: el listado de fondo; el modal lo pone @modal/[alumnoId].
export default function DetalleAlumnoPage() {
  return <AlumnosPantalla rutaBase="/mesa/alumnos" />
}
