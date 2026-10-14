import { normalizarBusqueda } from '@/server/shared/busqueda'

// Usuario con el que el alumno ingresa al portal (HU-27). Reglas puras: no consultan la base ni
// conocen Prisma. Qué usuarios están tomados lo averigua el repository; acá sólo se arma el texto.
//
// La misma regla está escrita en `prisma/seed.ts` (`usuarioDelAlumno` / `usuarioLibre`, T-72), que
// no es de esta tarea: los dos tienen que dar el mismo resultado, porque el alumno del seed ingresa
// con el usuario que generó ese archivo. Queda anotado como FIX para que el seed consuma esta regla.

/** Dominio reservado (RFC 2606) del email sintético del alumno: no entrega correo (T-132). */
export const DOMINIO_EMAIL_ALUMNOS = 'alumnos.aulaclick.invalid'

/** 409 al crear un acceso que ya existe (cada alumno tiene una sola cuenta, HU-27). */
export const MENSAJE_ACCESO_EXISTENTE = 'El alumno ya tiene acceso al portal'

/** 409 al restablecer la contraseña de un alumno que todavía no tiene acceso. */
export const MENSAJE_SIN_ACCESO = 'El alumno no tiene acceso al portal'

/** Intentos de sufijo antes de darse por vencido con una colisión (`base`, `base-2`… `base-20`). */
export const MAX_INTENTOS_USUARIO = 20

/** Deja sólo letras y números: sin tildes, sin espacios y con la "ñ" como "n". */
function sinSimbolos(texto: string): string {
  return normalizarBusqueda(texto).replace(/[^a-z0-9]/g, '')
}

/**
 * Usuario base: inicial del nombre + apellido + últimos 3 dígitos del DNI, en minúsculas, sin
 * espacios ni tildes y con la "ñ" como "n". Juan Pérez, DNI 45123456 → `"jperez456"`.
 * Un DNI de menos de 3 dígitos se usa entero (el schema ya exige 7 u 8).
 */
export function usuarioBase(nombre: string, apellido: string, dni: string): string {
  return `${sinSimbolos(nombre).charAt(0)}${sinSimbolos(apellido)}${sinSimbolos(dni).slice(-3)}`
}

/** El `intento` 1 es el base; del 2 en adelante, con sufijo: `"jperez456-2"`. */
export function usuarioConSufijo(base: string, intento: number): string {
  return intento <= 1 ? base : `${base}-${intento}`
}

/**
 * Primer usuario de la serie (`base`, `base-2`, `base-3`…) que no esté en `tomados`. Es sólo una
 * sugerencia mientras no se guarde: entre la consulta y el alta otro alta puede quedarse con él, y
 * ahí la colisión la resuelve el reintento del repository con el sufijo siguiente.
 */
export function primerUsuarioLibre(base: string, tomados: readonly string[]): string {
  const ocupados = new Set(tomados)
  for (let intento = 1; intento <= MAX_INTENTOS_USUARIO; intento++) {
    const candidato = usuarioConSufijo(base, intento)
    if (!ocupados.has(candidato)) return candidato
  }
  return usuarioConSufijo(base, MAX_INTENTOS_USUARIO + 1)
}

/** Email sintético de la cuenta: Better Auth exige uno y el alumno ingresa con su usuario (T-132). */
export function emailDeUsuario(usuario: string): string {
  return `${usuario}@${DOMINIO_EMAIL_ALUMNOS}`
}
