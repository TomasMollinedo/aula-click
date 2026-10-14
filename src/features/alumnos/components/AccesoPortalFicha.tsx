import type { AlumnoDetalle } from '../alumnos.types'

export type AccesoPortalFichaProps = {
  alumno: AlumnoDetalle
}

/**
 * Sección "Acceso al portal" de la pestaña "Datos" de la ficha (HU-27): el usuario del alumno, quién
 * lo creó, "Restablecer contraseña" o "Crear acceso al portal". La monta `DatosAlumno`. La completa
 * T-90.
 */
export function AccesoPortalFicha(props: AccesoPortalFichaProps) {
  void props
  return null
}
