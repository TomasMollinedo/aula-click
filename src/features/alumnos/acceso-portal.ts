import { formatoInstante } from '@/utils/auditoria'
import type { ApiError } from '@/utils/fetch-json'

import type { AccesoPortal } from './alumnos.types'
import type { DatosUsuarioSugerido } from './api/acceso.api'

// Acceso al portal del alumno (HU-27): cuándo pedir el usuario sugerido y los textos de la ficha.
// Sin reglas: el usuario lo arma la API.

/** El aviso de la contraseña inicial, en el alta y al crear el acceso desde la ficha. */
export const AVISO_CONTRASENA_INICIAL =
  'La contraseña inicial es el DNI del alumno (sin puntos). El alumno puede cambiarla desde Configuración en el portal.'

/**
 * Los datos para pedir el usuario sugerido, o `null` si todavía falta alguno: nombre y apellido
 * con algo escrito y un DNI de 7 u 8 dígitos (con o sin puntos). El DNI viaja sin puntos.
 */
export function datosParaSugerir(datos: DatosUsuarioSugerido): DatosUsuarioSugerido | null {
  const nombre = datos.nombre.trim()
  const apellido = datos.apellido.trim()
  const dni = datos.dni.replace(/\./g, '').trim()
  if (!nombre || !apellido || !/^\d{7,8}$/.test(dni)) return null
  return { nombre, apellido, dni }
}

const nombreDe = (u: { nombre: string; apellido: string } | null) =>
  u ? `${u.nombre} ${u.apellido}` : 'Sistema'

/** "Acceso creado por Ana Pérez el 14/10/2026, 10:45". */
export function textoAccesoCreado(acceso: AccesoPortal): string {
  return `Acceso creado por ${nombreDe(acceso.creadoPor)} el ${formatoInstante(acceso.creadoEl)}`
}

/** "Contraseña restablecida por … el …", o `null` si nunca se restableció. */
export function textoContrasenaRestablecida(acceso: AccesoPortal): string | null {
  if (!acceso.restablecidaEl) return null
  return `Contraseña restablecida por ${nombreDe(acceso.restablecidaPor)} el ${formatoInstante(acceso.restablecidaEl)}`
}

/** La confirmación de "Restablecer contraseña". */
export function textoConfirmarRestablecer(usuario: string): string {
  return `La contraseña de ${usuario} volverá a ser su DNI.`
}

/** El error de crear el acceso o restablecer la contraseña, para mostrarlo en la ficha. */
export function mensajeErrorAcceso(error: ApiError): string {
  if (error.status === 403) return 'No tenés permiso para administrar el acceso al portal'
  return error.message
}
