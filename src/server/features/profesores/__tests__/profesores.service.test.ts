import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '../profesores.repository'
import { crearProfesoresService } from '../profesores.service'

// El repository se reemplaza por un falso: sin Docker ni Postgres. El service importa el
// repository solo como tipo, así que no hace falta mockear el módulo real.

function crearRepository() {
  return {
    listarMateriasAsignadas: vi.fn<ProfesoresRepository['listarMateriasAsignadas']>(),
  }
}

let repository: ReturnType<typeof crearRepository>
let service: ReturnType<typeof crearProfesoresService>

beforeEach(() => {
  repository = crearRepository()
  service = crearProfesoresService({ repository })
})

describe('listarMateriasAsignadas', () => {
  it('devuelve las materias con asignación activa que informa el repository', async () => {
    const materias = [
      { id: 7, nombre: 'Física' },
      { id: 2, nombre: 'Matemática' },
    ]
    repository.listarMateriasAsignadas.mockResolvedValue(materias)

    await expect(service.listarMateriasAsignadas(3)).resolves.toEqual(materias)
    expect(repository.listarMateriasAsignadas).toHaveBeenCalledWith(3)
  })

  it('un profesor sin materias asignadas devuelve un arreglo vacío', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue([])

    await expect(service.listarMateriasAsignadas(3)).resolves.toEqual([])
  })

  it('profesor inexistente → NotFoundError', async () => {
    repository.listarMateriasAsignadas.mockResolvedValue(null)

    await expect(service.listarMateriasAsignadas(99)).rejects.toThrow(NotFoundError)
  })
})
