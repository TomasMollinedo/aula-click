import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { UsuariosRepository } from '../usuarios.repository'
import {
  MENSAJE_ACTUAL_INCORRECTA,
  MENSAJE_IGUAL_A_LA_ACTUAL,
  MENSAJE_IGUAL_AL_DNI,
  MENSAJE_MUY_CORTA,
  MENSAJE_NO_COINCIDEN,
  crearUsuariosService,
} from '../usuarios.service'
import { cambiarContrasenaSchema, type UsuarioGuardado } from '../usuarios.validation'

// El repository se reemplaza por uno falso: sin base ni Better Auth. Lo de Better Auth (verificar la
// actual y hashear la nueva) vive en el repository; acá sólo su resultado.

const actor: Actor = { userId: 'usr_alu', role: 'ALUMNO', alumnoId: 12 }
const sesion = new Headers({ cookie: 'better-auth.session_token=abc' })

const alumno: UsuarioGuardado = {
  id: 'usr_alu',
  nombre: 'Juan',
  apellido: 'Pérez',
  role: 'ALUMNO',
  usuario: 'jperez456',
  dni: '45123456',
  contrasenaInicial: true,
}

function crearRepository() {
  return {
    buscar: vi.fn<UsuariosRepository['buscar']>(),
    cambiarContrasena: vi.fn<UsuariosRepository['cambiarContrasena']>(),
    marcarContrasenaCambiada: vi.fn<UsuariosRepository['marcarContrasenaCambiada']>(),
  }
}

let repository: ReturnType<typeof crearRepository>
let service: ReturnType<typeof crearUsuariosService>

beforeEach(() => {
  repository = crearRepository()
  service = crearUsuariosService({ repository })
  repository.buscar.mockResolvedValue(alumno)
  repository.cambiarContrasena.mockResolvedValue('CAMBIADA')
  repository.marcarContrasenaCambiada.mockResolvedValue()
})

describe('miUsuario', () => {
  it('el usuario de la sesión, con contrasenaInicial y sin el DNI', async () => {
    expect(await service.miUsuario(actor)).toEqual({
      id: 'usr_alu',
      nombre: 'Juan',
      apellido: 'Pérez',
      role: 'ALUMNO',
      usuario: 'jperez456',
      contrasenaInicial: true,
    })
    expect(repository.buscar).toHaveBeenCalledWith('usr_alu')
  })

  it('un usuario que no existe → 404', async () => {
    repository.buscar.mockResolvedValue(null)
    await expect(service.miUsuario(actor)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('cambiarContrasena', () => {
  const datos = (parcial: Partial<{ actual: string; nueva: string; repeticion: string }> = {}) => ({
    actual: '45123456',
    nueva: 'MiClave2026',
    repeticion: 'MiClave2026',
    ...parcial,
  })

  /** El 400 que lanza: en qué campo y con qué mensaje. */
  async function errorDe(d: ReturnType<typeof datos>) {
    const error = await service.cambiarContrasena(d, actor, sesion).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ValidationError)
    const { details } = error as ValidationError
    return (details as { path: string[]; message: string }[])[0]
  }

  it('cambia la contraseña, apaga contrasenaInicial y usa la sesión del pedido', async () => {
    const resultado = await service.cambiarContrasena(datos(), actor, sesion)

    expect(repository.cambiarContrasena).toHaveBeenCalledWith(sesion, {
      actual: '45123456',
      nueva: 'MiClave2026',
    })
    expect(repository.marcarContrasenaCambiada).toHaveBeenCalledWith('usr_alu')
    expect(resultado.contrasenaInicial).toBe(false)
  })

  it('nueva y repetición distintas → 400 en repeticion', async () => {
    expect(await errorDe(datos({ repeticion: 'OtraClave2026' }))).toEqual({
      path: ['repeticion'],
      message: MENSAJE_NO_COINCIDEN,
    })
  })

  it('nueva de menos de 8 caracteres → 400 en nueva', async () => {
    expect(await errorDe(datos({ nueva: 'corta1', repeticion: 'corta1' }))).toEqual({
      path: ['nueva'],
      message: MENSAJE_MUY_CORTA,
    })
  })

  it('nueva igual a la actual → 400 en nueva', async () => {
    expect(
      await errorDe(
        datos({ actual: 'MiClave2026', nueva: 'MiClave2026', repeticion: 'MiClave2026' }),
      ),
    ).toEqual({ path: ['nueva'], message: MENSAJE_IGUAL_A_LA_ACTUAL })
  })

  it.each(['45123456', '45.123.456'])('nueva igual al DNI (%s) → 400 en nueva', async (dni) => {
    expect(await errorDe(datos({ actual: 'OtraClave1', nueva: dni, repeticion: dni }))).toEqual({
      path: ['nueva'],
      message: MENSAJE_IGUAL_AL_DNI,
    })
  })

  it('actual incorrecta → 400 en actual y no cambia nada', async () => {
    repository.cambiarContrasena.mockResolvedValue('ACTUAL_INCORRECTA')

    expect(await errorDe(datos({ actual: 'equivocada' }))).toEqual({
      path: ['actual'],
      message: MENSAJE_ACTUAL_INCORRECTA,
    })
    expect(repository.marcarContrasenaCambiada).not.toHaveBeenCalled()
  })

  it('el orden: con varias fallas a la vez, gana la primera (coinciden antes que el largo)', async () => {
    expect((await errorDe(datos({ nueva: 'corta', repeticion: 'distinta' })))?.path).toEqual([
      'repeticion',
    ])
    expect(repository.cambiarContrasena).not.toHaveBeenCalled()
  })

  it('las reglas de la nueva se chequean antes de verificar la actual con Better Auth', async () => {
    await errorDe(datos({ nueva: 'corta1', repeticion: 'corta1' }))
    expect(repository.cambiarContrasena).not.toHaveBeenCalled()
  })
})

describe('body (Zod): los tres campos son obligatorios', () => {
  it.each(['actual', 'nueva', 'repeticion'])('sin %s → 400 en ese campo', (campo) => {
    const body: Record<string, string> = { actual: 'a', nueva: 'b', repeticion: 'c' }
    body[campo] = ''
    const r = cambiarContrasenaSchema.safeParse(body)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual([campo])
  })
})
