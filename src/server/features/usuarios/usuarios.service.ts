import { LARGO_MINIMO_PASSWORD } from '@/lib/auth-reglas'
import { NotFoundError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { UsuariosRepository } from './usuarios.repository'
import type { CambiarContrasena, MiUsuario, UsuarioGuardado } from './usuarios.validation'

// Reglas de `usuarios` (HU-28): lo que vale para cualquier usuario sin importar su rol. No conoce
// HTTP ni Prisma: lanza AppError o sus subclases. La contraseña actual la verifica Better Auth (en
// el repository): acá no se reimplementa el hash.

export const MENSAJE_NO_COINCIDEN = 'Las contraseñas no coinciden'
export const MENSAJE_MUY_CORTA = `La contraseña nueva tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`
export const MENSAJE_IGUAL_A_LA_ACTUAL = 'La contraseña nueva tiene que ser distinta de la actual'
export const MENSAJE_IGUAL_AL_DNI = 'La contraseña nueva no puede ser tu DNI'
export const MENSAJE_ACTUAL_INCORRECTA = 'La contraseña actual no es correcta'

/** Un 400 sobre un campo del body, con la misma forma que las issues de Zod. */
function errorEn(campo: keyof CambiarContrasena, mensaje: string): ValidationError {
  return new ValidationError(mensaje, { details: [{ path: [campo], message: mensaje }] })
}

function aMiUsuario(usuario: UsuarioGuardado): MiUsuario {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    role: usuario.role,
    usuario: usuario.usuario,
    contrasenaInicial: usuario.contrasenaInicial,
  }
}

/**
 * Crea el service con su repository. El controller arma la instancia con el real; los tests, con
 * uno falso.
 */
export function crearUsuariosService({
  repository,
}: {
  repository: Pick<UsuariosRepository, 'buscar' | 'cambiarContrasena' | 'marcarContrasenaCambiada'>
}) {
  async function buscar(actor: Actor): Promise<UsuarioGuardado> {
    const usuario = await repository.buscar(actor.userId)
    if (!usuario) throw new NotFoundError('Usuario no encontrado')
    return usuario
  }

  return {
    /** `GET /usuarios/mi-usuario`: el usuario de la sesión, con `contrasenaInicial`. */
    async miUsuario(actor: Actor): Promise<MiUsuario> {
      return aMiUsuario(await buscar(actor))
    },

    /**
     * `PATCH /usuarios/mi-usuario/contrasena`. Chequeos, en orden (el primero que falla gana):
     * 1. Los tres campos, obligatorios: lo valida Zod (400).
     * 2. `nueva` y `repeticion` iguales (400 en `repeticion`).
     * 3. `nueva` de al menos `LARGO_MINIMO_PASSWORD` caracteres, distinta de la actual y del DNI del
     *    alumno, con o sin puntos (400 en `nueva`).
     * 4. `actual` correcta, verificada por Better Auth (400 en `actual`). Si no, no cambia nada.
     * Después, `contrasenaInicial: false`. La sesión sigue abierta.
     *
     * `sesion` son los headers del pedido: Better Auth los necesita para saber de quién es.
     */
    async cambiarContrasena(
      datos: CambiarContrasena,
      actor: Actor,
      sesion: Headers,
    ): Promise<MiUsuario> {
      const { actual, nueva, repeticion } = datos
      if (nueva !== repeticion) throw errorEn('repeticion', MENSAJE_NO_COINCIDEN)
      if (nueva.length < LARGO_MINIMO_PASSWORD) throw errorEn('nueva', MENSAJE_MUY_CORTA)
      if (nueva === actual) throw errorEn('nueva', MENSAJE_IGUAL_A_LA_ACTUAL)

      const usuario = await buscar(actor)
      if (nueva.replace(/\./g, '') === usuario.dni.replace(/\./g, '')) {
        throw errorEn('nueva', MENSAJE_IGUAL_AL_DNI)
      }

      const resultado = await repository.cambiarContrasena(sesion, { actual, nueva })
      if (resultado === 'ACTUAL_INCORRECTA') throw errorEn('actual', MENSAJE_ACTUAL_INCORRECTA)

      await repository.marcarContrasenaCambiada(usuario.id)
      return aMiUsuario({ ...usuario, contrasenaInicial: false })
    },
  }
}

export type UsuariosService = ReturnType<typeof crearUsuariosService>
