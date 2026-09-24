import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { ProfesorParaBloque } from '@/server/features/profesores/profesores.validation'
import type { Actor } from '@/server/shared/actor'
import type { BloquesRepository } from '../bloques.repository'
import { crearBloquesService } from '../bloques.service'
import type { BloqueCreado, CrearBloque } from '../bloques.validation'

// El repository de bloques y el de profesores (solo lectura, cross-feature) se reemplazan por
// falsos: sin Docker ni Postgres. El service los importa solo como tipo.

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

const ACTIVO_CON_MATERIA: ProfesorParaBloque = { estado: 'ACTIVO', tieneMateriaActiva: true }

const DATOS: CrearBloque = {
  profesorId: 3,
  diaSemana: 1,
  horaInicio: '14:00',
  horaFin: '15:00',
  aulaId: 7,
}

function crearRepositories() {
  return {
    repository: { crearBloques: vi.fn<BloquesRepository['crearBloques']>() },
    profesoresRepository: { buscarParaBloque: vi.fn<ProfesoresRepository['buscarParaBloque']>() },
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let profesoresRepository: ReturnType<typeof crearRepositories>['profesoresRepository']
let service: ReturnType<typeof crearBloquesService>

beforeEach(() => {
  ;({ repository, profesoresRepository } = crearRepositories())
  service = crearBloquesService({ repository, profesoresRepository })
  profesoresRepository.buscarParaBloque.mockResolvedValue(ACTIVO_CON_MATERIA)
})

/** Ejecuta `accion`, que debe fallar, y devuelve el error. */
function errorDe(accion: Promise<unknown>) {
  return accion.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error,
  )
}

const bloqueCreado = (horaInicio: string, horaFin: string, id: number): BloqueCreado => ({
  id,
  diaSemana: DATOS.diaSemana,
  horaInicio,
  horaFin,
  aula: { id: DATOS.aulaId, nombre: 'Aula 3' },
})

describe('crear', () => {
  it('una hora: pide al profesor una sola hora y devuelve cantidad 1', async () => {
    const creado = bloqueCreado('14:00', '15:00', 10)
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
      bloqueCreado('14:00', '15:00', 10),
      bloqueCreado('15:00', '16:00', 11),
      bloqueCreado('16:00', '17:00', 12),
      bloqueCreado('17:00', '18:00', 13),
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
