import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { ProfesorParaBloque } from '@/server/features/profesores/profesores.validation'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import type { BloquesRepository } from '../bloques.repository'
import { crearBloquesService } from '../bloques.service'
import type { Bloque, BloqueGuardado, CrearBloque } from '../bloques.validation'

// El repository de bloques y los de profesores/turnos (solo lectura, cross-feature) se reemplazan
// por falsos: sin Docker ni Postgres. El service los importa solo como tipo.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

// Mediodía del 22/09/2026 en Salta (UTC-3).
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

const ACTIVO_CON_MATERIA: ProfesorParaBloque = { estado: 'ACTIVO', tieneMateriaActiva: true }

const DATOS: CrearBloque = {
  profesorId: 3,
  diaSemana: 1,
  horaInicio: '14:00',
  horaFin: '15:00',
  aulaId: 7,
}

const ACTUAL: BloqueGuardado = {
  id: 10,
  profesorId: 3,
  aulaId: 7,
  diaSemana: 1,
  horaInicio: 840, // 14:00
  horaFin: 900, // 15:00
  estado: 'ACTIVO',
}

function crearRepositories() {
  return {
    repository: {
      crearBloques: vi.fn<BloquesRepository['crearBloques']>(),
      buscarPorId: vi.fn<BloquesRepository['buscarPorId']>(),
      editarBloque: vi.fn<BloquesRepository['editarBloque']>(),
      eliminarBloque: vi.fn<BloquesRepository['eliminarBloque']>(),
    },
    profesoresRepository: { buscarParaBloque: vi.fn<ProfesoresRepository['buscarParaBloque']>() },
    turnosRepository: {
      contarVigentesPorBloque: vi.fn<TurnosRepository['contarVigentesPorBloque']>(),
    },
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let profesoresRepository: ReturnType<typeof crearRepositories>['profesoresRepository']
let turnosRepository: ReturnType<typeof crearRepositories>['turnosRepository']
let service: ReturnType<typeof crearBloquesService>

beforeEach(() => {
  ;({ repository, profesoresRepository, turnosRepository } = crearRepositories())
  service = crearBloquesService({
    repository,
    profesoresRepository,
    turnosRepository,
    reloj: relojFijo,
  })
  profesoresRepository.buscarParaBloque.mockResolvedValue(ACTIVO_CON_MATERIA)
  turnosRepository.contarVigentesPorBloque.mockResolvedValue(0)
})

/** Ejecuta `accion`, que debe fallar, y devuelve el error. */
function errorDe(accion: Promise<unknown>) {
  return accion.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error,
  )
}

const bloque = (horaInicio: string, horaFin: string, id: number): Bloque => ({
  id,
  diaSemana: DATOS.diaSemana,
  horaInicio,
  horaFin,
  aula: { id: DATOS.aulaId, nombre: 'Aula 3' },
})

describe('crear', () => {
  it('una hora: pide al profesor una sola hora y devuelve cantidad 1', async () => {
    const creado = bloque('14:00', '15:00', 10)
    repository.crearBloques.mockResolvedValue([creado])

    const resultado = await service.crear(DATOS, actor)

    expect(profesoresRepository.buscarParaBloque).toHaveBeenCalledWith(3)
    expect(repository.crearBloques).toHaveBeenCalledWith(
      { profesorId: 3, aulaId: 7, diaSemana: 1, horas: [{ horaInicio: 840, horaFin: 900 }] },
      actor,
    )
    expect(resultado).toEqual({ cantidad: 1, bloques: [creado] })
  })

  it('un rango de varias horas parte en tramos de una hora y pasa los 4 al repository', async () => {
    const datos = { ...DATOS, horaInicio: '14:00', horaFin: '18:00' }
    const creados = [
      bloque('14:00', '15:00', 10),
      bloque('15:00', '16:00', 11),
      bloque('16:00', '17:00', 12),
      bloque('17:00', '18:00', 13),
    ]
    repository.crearBloques.mockResolvedValue(creados)

    const resultado = await service.crear(datos, actor)

    expect(repository.crearBloques).toHaveBeenCalledWith(
      {
        profesorId: 3,
        aulaId: 7,
        diaSemana: 1,
        horas: [
          { horaInicio: 840, horaFin: 900 },
          { horaInicio: 900, horaFin: 960 },
          { horaInicio: 960, horaFin: 1020 },
          { horaInicio: 1020, horaFin: 1080 },
        ],
      },
      actor,
    )
    expect(resultado).toEqual({ cantidad: 4, bloques: creados })
  })

  it('profesor inexistente → NotFoundError, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue(null)

    const error = await errorDe(service.crear(DATOS, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Profesor no encontrado' })
    expect(repository.crearBloques).not.toHaveBeenCalled()
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })

    const error = await errorDe(service.crear(DATOS, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_INACTIVO' })
    expect(repository.crearBloques).not.toHaveBeenCalled()
  })

  it('profesor sin materias asignadas → 409 PROFESOR_SIN_MATERIAS, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'ACTIVO',
      tieneMateriaActiva: false,
    })

    const error = await errorDe(service.crear(DATOS, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_SIN_MATERIAS' })
    expect(repository.crearBloques).not.toHaveBeenCalled()
  })

  it('bloque superpuesto: propaga el ConflictError BLOQUE_SUPERPUESTO del repository tal cual', async () => {
    const conflicto = new ConflictError('El profesor ya tiene un bloque en ese horario', {
      code: 'BLOQUE_SUPERPUESTO',
      details: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', bloqueExistenteId: 5 }],
    })
    repository.crearBloques.mockRejectedValue(conflicto)

    await expect(service.crear(DATOS, actor)).rejects.toBe(conflicto)
  })

  it('aula ocupada: propaga el ConflictError AULA_OCUPADA del repository tal cual', async () => {
    const conflicto = new ConflictError(
      'No hay un aula disponible en ese horario. Por favor, elija otro horario.',
      {
        code: 'AULA_OCUPADA',
        details: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00', profesorId: 9 }],
      },
    )
    repository.crearBloques.mockRejectedValue(conflicto)

    await expect(service.crear(DATOS, actor)).rejects.toBe(conflicto)
  })

  it('aula inexistente: propaga el NotFoundError del repository tal cual', async () => {
    const noEncontrada = new NotFoundError('Aula no encontrada')
    repository.crearBloques.mockRejectedValue(noEncontrada)

    await expect(service.crear(DATOS, actor)).rejects.toBe(noEncontrada)
  })
})

describe('editar', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(ACTUAL)
  })

  it('cambia solo la hora: fusiona con la fila actual y valida que siga durando una hora', async () => {
    const editado = bloque('15:00', '16:00', 10)
    repository.editarBloque.mockResolvedValue(editado)

    const resultado = await service.editar(10, { horaInicio: '15:00', horaFin: '16:00' }, actor)

    expect(repository.editarBloque).toHaveBeenCalledWith(
      10,
      { diaSemana: 1, horaInicio: 900, horaFin: 960, aulaId: 7 },
      actor,
    )
    expect(resultado).toEqual(editado)
  })

  it('cambia solo el aula: conserva día y horario actuales', async () => {
    repository.editarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await service.editar(10, { aulaId: 9 }, actor)

    expect(repository.editarBloque).toHaveBeenCalledWith(
      10,
      { diaSemana: 1, horaInicio: 840, horaFin: 900, aulaId: 9 },
      actor,
    )
  })

  it('consulta los turnos vigentes de esa fila con la fecha de hoy del reloj', async () => {
    repository.editarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await service.editar(10, { aulaId: 9 }, actor)

    expect(turnosRepository.contarVigentesPorBloque).toHaveBeenCalledWith(10, HOY)
  })

  it('bloque inexistente → NotFoundError, sin consultar turnos ni al profesor', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.editar(99, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Bloque no encontrado' })
    expect(turnosRepository.contarVigentesPorBloque).not.toHaveBeenCalled()
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad, sin tocar nada más', async () => {
    turnosRepository.contarVigentesPorBloque.mockResolvedValue(2)

    const error = await errorDe(service.editar(10, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'TURNOS_VIGENTES', details: { cantidad: 2 } })
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('el resultado deja de durar una hora exacta → 400 VALIDACION, sin llamar al repository', async () => {
    const error = await errorDe(service.editar(10, { horaFin: '16:00' }, actor))

    expect(error).toBeInstanceOf(ValidationError)
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('profesor inactivo → 409 PROFESOR_INACTIVO, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })

    const error = await errorDe(service.editar(10, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_INACTIVO' })
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('profesor sin materias → 409 PROFESOR_SIN_MATERIAS, sin llamar al repository de bloques', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'ACTIVO',
      tieneMateriaActiva: false,
    })

    const error = await errorDe(service.editar(10, { aulaId: 9 }, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROFESOR_SIN_MATERIAS' })
    expect(repository.editarBloque).not.toHaveBeenCalled()
  })

  it('bloque superpuesto: propaga el ConflictError BLOQUE_SUPERPUESTO del repository tal cual', async () => {
    const conflicto = new ConflictError('El profesor ya tiene un bloque en ese horario', {
      code: 'BLOQUE_SUPERPUESTO',
      details: [{ diaSemana: 1, horaInicio: '15:00', horaFin: '16:00', bloqueExistenteId: 20 }],
    })
    repository.editarBloque.mockRejectedValue(conflicto)

    await expect(service.editar(10, { horaInicio: '15:00', horaFin: '16:00' }, actor)).rejects.toBe(
      conflicto,
    )
  })

  it('aula inexistente: propaga el NotFoundError del repository tal cual', async () => {
    const noEncontrada = new NotFoundError('Aula no encontrada')
    repository.editarBloque.mockRejectedValue(noEncontrada)

    await expect(service.editar(10, { aulaId: 999 }, actor)).rejects.toBe(noEncontrada)
  })
})

describe('eliminar', () => {
  beforeEach(() => {
    repository.buscarPorId.mockResolvedValue(ACTUAL)
  })

  it('sin turnos ni excepciones vigentes: da de baja y no valida al profesor', async () => {
    const eliminado = bloque('14:00', '15:00', 10)
    repository.eliminarBloque.mockResolvedValue(eliminado)

    const resultado = await service.eliminar(10, actor)

    expect(repository.eliminarBloque).toHaveBeenCalledWith(10, actor)
    expect(profesoresRepository.buscarParaBloque).not.toHaveBeenCalled()
    expect(resultado).toEqual(eliminado)
  })

  it('se puede dar de baja aunque el profesor esté inactivo', async () => {
    profesoresRepository.buscarParaBloque.mockResolvedValue({
      estado: 'INACTIVO',
      tieneMateriaActiva: true,
    })
    repository.eliminarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await expect(service.eliminar(10, actor)).resolves.not.toThrow()
  })

  it('bloque inexistente → NotFoundError, sin consultar turnos', async () => {
    repository.buscarPorId.mockResolvedValue(null)

    const error = await errorDe(service.eliminar(99, actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ message: 'Bloque no encontrado' })
    expect(turnosRepository.contarVigentesPorBloque).not.toHaveBeenCalled()
    expect(repository.eliminarBloque).not.toHaveBeenCalled()
  })

  it('con turnos vigentes → 409 TURNOS_VIGENTES con la cantidad, sin dar de baja', async () => {
    turnosRepository.contarVigentesPorBloque.mockResolvedValue(1)

    const error = await errorDe(service.eliminar(10, actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'TURNOS_VIGENTES', details: { cantidad: 1 } })
    expect(repository.eliminarBloque).not.toHaveBeenCalled()
  })

  it('consulta los turnos vigentes de esa fila con la fecha de hoy del reloj', async () => {
    repository.eliminarBloque.mockResolvedValue(bloque('14:00', '15:00', 10))

    await service.eliminar(10, actor)

    expect(turnosRepository.contarVigentesPorBloque).toHaveBeenCalledWith(10, HOY)
  })
})
