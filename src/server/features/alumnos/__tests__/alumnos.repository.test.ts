import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/server/shared/actor'
import { alumnosRepository } from '../alumnos.repository'

// Excepcional (arquitectura-backend.md → Tests): fija dos invariantes de atomicidad que el service
// no puede observar, porque los garantiza la transacción (HU-27):
//   1. el alumno, su `Usuario` y su `Account` se crean en **una sola** transacción (las tres filas
//      o ninguna), y
//   2. si otra alta se queda con el usuario entre la consulta y el `INSERT` (P2002), se reintenta
//      con el sufijo siguiente.
// También fija que editar el nombre sincroniza el del `Usuario` pero **no** toca su `username`.
// Sin base ni variables de entorno: Prisma, auth y storage se reemplazan por mocks.

const {
  transaction,
  alumnoCreate,
  alumnoUpdate,
  alumnoFindUnique,
  usuarioCreate,
  usuarioFindMany,
  usuarioUpdate,
  accountUpdateMany,
  ErrorConocido,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  alumnoCreate: vi.fn(),
  alumnoUpdate: vi.fn(),
  alumnoFindUnique: vi.fn(),
  usuarioCreate: vi.fn(),
  usuarioFindMany: vi.fn(),
  usuarioUpdate: vi.fn(),
  accountUpdateMany: vi.fn(),
  // El error del motor, sin importar Prisma (el test no es un repository: ESLint no se lo permite).
  ErrorConocido: class extends Error {
    constructor(
      message: string,
      readonly opciones: { code: string; meta?: Record<string, unknown> },
    ) {
      super(message)
    }
    get code() {
      return this.opciones.code
    }
    get meta() {
      return this.opciones.meta
    }
  },
}))
vi.mock('@/generated/prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: ErrorConocido },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    alumno: { findUnique: alumnoFindUnique },
    usuario: { findMany: usuarioFindMany },
    account: { updateMany: accountUpdateMany },
  },
}))
vi.mock('@/lib/auth', () => ({ hashPassword: vi.fn(() => Promise.resolve('hash')) }))
vi.mock('@/lib/storage', () => ({ putObject: vi.fn(), deleteObject: vi.fn() }))

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

const tx = {
  alumno: { create: alumnoCreate, update: alumnoUpdate },
  usuario: { create: usuarioCreate, update: usuarioUpdate },
}

const alta = {
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '45123456',
  fechaNacimiento: '1990-05-14',
  telefono: '387154123456',
  busqueda: 'perez juan 45123456',
}

/** P2002 tal como llega con Prisma 7 + `@prisma/adapter-pg`, con el índice que chocó. */
function duplicado(indice: string) {
  return new ErrorConocido('Unique constraint failed', {
    code: 'P2002',
    meta: { driverAdapterError: { cause: { constraint: { index: indice } } } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx))
  alumnoCreate.mockResolvedValue({ id: 7 })
  usuarioCreate.mockResolvedValue({ id: 'usr_nuevo' })
  usuarioFindMany.mockResolvedValue([])
  // El detalle que devuelve el alta después de escribir.
  alumnoFindUnique.mockResolvedValue(null)
  accountUpdateMany.mockResolvedValue({ count: 1 })
})

describe('crear: el alumno y su acceso, en una sola transacción', () => {
  it('escribe el alumno, su Usuario y su Account dentro de la misma transacción', async () => {
    await alumnosRepository.crear(alta, actor).catch(() => undefined)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(alumnoCreate).toHaveBeenCalledTimes(1)
    expect(usuarioCreate).toHaveBeenCalledTimes(1)

    const datos = usuarioCreate.mock.calls[0]?.[0]?.data
    expect(datos).toMatchObject({
      role: 'ALUMNO',
      alumnoId: 7,
      username: 'jperez456',
      displayUsername: 'jperez456',
      email: 'jperez456@alumnos.aulaclick.invalid',
      dni: '45123456',
      telefono: '387154123456',
      createdById: 'usr_mesa',
    })
    // La cuenta credential va anidada en la misma escritura: su contraseña es el DNI hasheado.
    expect(datos.accounts.create).toMatchObject({
      providerId: 'credential',
      password: 'hash',
      contrasenaInicial: true,
    })
  })

  it('si falla la cuenta, no queda el alumno: la transacción es una sola', async () => {
    usuarioCreate.mockRejectedValue(duplicado('usuario_dni_key'))

    await expect(alumnosRepository.crear(alta, actor)).rejects.toThrow(
      'Ya existe un usuario con ese DNI',
    )
    // Una sola transacción: lo que escribió `alumno.create` se deshace con ella.
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('el teléfono del alumno puede ser el del tutor si no tiene propio', async () => {
    await alumnosRepository
      .crear({ ...alta, telefono: null, tutorTelefono: '387155000111' }, actor)
      .catch(() => undefined)

    expect(usuarioCreate.mock.calls[0]?.[0]?.data).toMatchObject({ telefono: '387155000111' })
  })

  it('un usuario ya tomado se saltea con el sufijo siguiente', async () => {
    usuarioFindMany.mockResolvedValue([{ username: 'jperez456' }, { username: 'jperez456-2' }])

    await alumnosRepository.crear(alta, actor).catch(() => undefined)

    expect(usuarioCreate.mock.calls[0]?.[0]?.data).toMatchObject({ username: 'jperez456-3' })
  })

  it('una colisión por concurrencia (P2002 del usuario) se reintenta con el sufijo siguiente', async () => {
    usuarioCreate.mockRejectedValueOnce(duplicado('usuario_username_key'))
    // En el reintento, el usuario ya figura tomado.
    usuarioFindMany.mockResolvedValueOnce([]).mockResolvedValue([{ username: 'jperez456' }])

    await alumnosRepository.crear(alta, actor).catch(() => undefined)

    expect(usuarioCreate).toHaveBeenCalledTimes(2)
    expect(usuarioCreate.mock.calls[0]?.[0]?.data).toMatchObject({ username: 'jperez456' })
    expect(usuarioCreate.mock.calls[1]?.[0]?.data).toMatchObject({ username: 'jperez456-2' })
  })

  it('un DNI de alumno repetido no se reintenta: es un conflicto', async () => {
    alumnoCreate.mockRejectedValue(duplicado('alumno_dni_key'))

    await expect(alumnosRepository.crear(alta, actor)).rejects.toThrow(
      'Ya existe un alumno con ese DNI',
    )
    expect(alumnoCreate).toHaveBeenCalledTimes(1)
  })
})

describe('actualizar: el usuario de ingreso no cambia (HU-27)', () => {
  beforeEach(() => {
    alumnoUpdate.mockResolvedValue({
      nombre: 'Juan Carlos',
      apellido: 'Pérez',
      dni: '45123456',
      usuario: { id: 'usr_alumno' },
    })
  })

  it('cambiar el nombre sincroniza el del Usuario, sin tocar su username', async () => {
    await alumnosRepository
      .actualizar(7, { nombre: 'Juan Carlos', busqueda: 'perez juan carlos 45123456' }, actor)
      .catch(() => undefined)

    const datos = usuarioUpdate.mock.calls[0]?.[0]?.data
    expect(datos).toEqual({
      nombre: 'Juan Carlos',
      apellido: 'Pérez',
      busqueda: 'perez juan carlos 45123456',
      updatedById: 'usr_mesa',
    })
    expect(datos).not.toHaveProperty('username')
    expect(datos).not.toHaveProperty('email')
  })

  it('un cambio que no toca el nombre no escribe en el Usuario', async () => {
    await alumnosRepository
      .actualizar(7, { grado: '5° año', busqueda: 'perez juan 45123456' }, actor)
      .catch(() => undefined)

    expect(usuarioUpdate).not.toHaveBeenCalled()
  })

  it('un alumno sin cuenta no intenta sincronizar nada', async () => {
    alumnoUpdate.mockResolvedValue({
      nombre: 'Juan Carlos',
      apellido: 'Pérez',
      dni: '45123456',
      usuario: null,
    })

    await alumnosRepository
      .actualizar(7, { nombre: 'Juan Carlos', busqueda: 'perez juan carlos 45123456' }, actor)
      .catch(() => undefined)

    expect(usuarioUpdate).not.toHaveBeenCalled()
  })
})

describe('restablecerContrasena: la contraseña vuelve al DNI (T-135)', () => {
  it('escribe el hash del DNI, la marca como inicial y registra quién y cuándo', async () => {
    alumnoFindUnique.mockResolvedValue({ dni: '45123456', usuario: { id: 'usr_alumno' } })

    await alumnosRepository.restablecerContrasena(7, actor).catch(() => undefined)

    const llamada = accountUpdateMany.mock.calls[0]?.[0]
    expect(llamada.where).toEqual({ userId: 'usr_alumno', providerId: 'credential' })
    expect(llamada.data).toMatchObject({
      password: 'hash',
      contrasenaInicial: true,
      contrasenaRestablecidaPorId: 'usr_mesa',
    })
    expect(llamada.data.contrasenaRestablecidaFecha).toBeInstanceOf(Date)
  })

  it('un alumno sin acceso no toca ninguna cuenta', async () => {
    alumnoFindUnique.mockResolvedValue({ dni: '45123456', usuario: null })

    await expect(alumnosRepository.restablecerContrasena(7, actor)).rejects.toThrow(
      'El alumno no tiene acceso al portal',
    )
    expect(accountUpdateMany).not.toHaveBeenCalled()
  })

  it('un alumno que no existe devuelve null, sin escribir nada', async () => {
    alumnoFindUnique.mockResolvedValue(null)

    await expect(alumnosRepository.restablecerContrasena(99, actor)).resolves.toBe(null)
    expect(accountUpdateMany).not.toHaveBeenCalled()
  })
})

describe('crearAcceso: el acceso de un alumno anterior al incremento', () => {
  it('crea la cuenta con el usuario de la regla y el DNI como contraseña inicial', async () => {
    alumnoFindUnique.mockResolvedValue({
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '45123456',
      telefono: '387154123456',
      tutorTelefono: null,
      usuario: null,
    })

    await alumnosRepository.crearAcceso(7, actor).catch(() => undefined)

    const datos = usuarioCreate.mock.calls[0]?.[0]?.data
    expect(datos).toMatchObject({ username: 'jperez456', role: 'ALUMNO', alumnoId: 7 })
    expect(datos.accounts.create).toMatchObject({ password: 'hash', contrasenaInicial: true })
  })

  it('un alumno que ya tiene cuenta no crea otra', async () => {
    alumnoFindUnique.mockResolvedValue({
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '45123456',
      telefono: '387154123456',
      tutorTelefono: null,
      usuario: { id: 'usr_alumno' },
    })

    await expect(alumnosRepository.crearAcceso(7, actor)).rejects.toThrow(
      'El alumno ya tiene acceso al portal',
    )
    expect(usuarioCreate).not.toHaveBeenCalled()
  })
})
