import { isAPIError } from 'better-auth/api'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { esRole } from '@/server/shared/actor'
import type { UsuarioGuardado } from './usuarios.validation'

// Único lugar de la feature que usa Prisma y Better Auth. Sin reglas de negocio: qué contraseña se
// acepta lo decide el service.

/** El resultado de pedirle a Better Auth el cambio de contraseña. */
export type ResultadoCambio = 'CAMBIADA' | 'ACTUAL_INCORRECTA'

export const usuariosRepository = {
  /**
   * El usuario con su `contrasenaInicial`, que vive en la cuenta `credential` (decisión T-135; sin
   * cuenta, `false`), y su DNI. `null` si no existe.
   */
  async buscar(id: string): Promise<UsuarioGuardado | null> {
    const fila = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        role: true,
        username: true,
        dni: true,
        accounts: { where: { providerId: 'credential' }, select: { contrasenaInicial: true } },
      },
    })
    if (!fila || !esRole(fila.role)) return null
    return {
      id: fila.id,
      nombre: fila.nombre,
      apellido: fila.apellido,
      role: fila.role,
      usuario: fila.username,
      dni: fila.dni,
      contrasenaInicial: fila.accounts[0]?.contrasenaInicial ?? false,
    }
  },

  /**
   * Cambia la contraseña con Better Auth (`auth.api.changePassword`), que verifica la actual y
   * hashea la nueva: no se reimplementa el hash. Usa la sesión del pedido (`headers`) y no cierra las
   * otras sesiones: la sesión sigue abierta. Una actual incorrecta es `ACTUAL_INCORRECTA`; cualquier
   * otro error sube tal cual.
   */
  async cambiarContrasena(
    headers: Headers,
    datos: { actual: string; nueva: string },
  ): Promise<ResultadoCambio> {
    try {
      await auth.api.changePassword({
        headers,
        body: {
          currentPassword: datos.actual,
          newPassword: datos.nueva,
          revokeOtherSessions: false,
        },
      })
      return 'CAMBIADA'
    } catch (error) {
      if (isAPIError(error) && error.body?.code === 'INVALID_PASSWORD') return 'ACTUAL_INCORRECTA'
      throw error
    }
  },

  /** Ya no es la contraseña inicial: el portal deja de recomendar cambiarla (HU-28). */
  async marcarContrasenaCambiada(id: string): Promise<void> {
    await prisma.account.updateMany({
      where: { userId: id, providerId: 'credential' },
      data: { contrasenaInicial: false },
    })
  },
}

export type UsuariosRepository = typeof usuariosRepository
