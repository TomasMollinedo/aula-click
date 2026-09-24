import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { AulasRepository } from '../aulas.repository'
import { crearAulasService } from '../aulas.service'
import type { AulaGuardada } from '../aulas.validation'

// Los repositories de aulas y de bloques (solo lectura, cross-feature) se reemplazan por falsos:
// sin Docker ni Postgres. El service los importa solo como tipo.

const AULAS: AulaGuardada[] = [
  { id: 1, nombre: 'Aula 1', capacidad: 8, estado: 'ACTIVO' },
  { id: 2, nombre: 'Aula 2', capacidad: 12, estado: 'ACTIVO' },
  { id: 3, nombre: 'Aula 3', capacidad: 10, estado: 'ACTIVO' },
]

const QUERY = { diaSemana: 1, horaInicio: '14:00', horaFin: '17:00' }

function crearRepositories() {
  return {
    repository: { listar: vi.fn<AulasRepository['listar']>() },
    bloquesRepository: { aulasOcupadas: vi.fn<BloquesRepository['aulasOcupadas']>() },
  }
}

let repository: ReturnType<typeof crearRepositories>['repository']
let bloquesRepository: ReturnType<typeof crearRepositories>['bloquesRepository']
let service: ReturnType<typeof crearAulasService>

beforeEach(() => {
  ;({ repository, bloquesRepository } = crearRepositories())
  service = crearAulasService({ repository, bloquesRepository })
  repository.listar.mockResolvedValue(AULAS)
  bloquesRepository.aulasOcupadas.mockResolvedValue([])
})

describe('disponibles', () => {
  it('pide la ocupación de cada hora del rango y devuelve las libres, sin el estado', async () => {
    bloquesRepository.aulasOcupadas.mockResolvedValue([2])

    const resultado = await service.disponibles(QUERY)

    expect(bloquesRepository.aulasOcupadas).toHaveBeenCalledWith({
      diaSemana: 1,
      horasPedidas: [840, 900, 960], // 14, 15 y 16 hs: libre durante todo el rango
      excluirBloqueId: undefined,
    })
    expect(resultado).toEqual([
      { id: 1, nombre: 'Aula 1', capacidad: 8 },
      { id: 3, nombre: 'Aula 3', capacidad: 10 },
    ])
  })

  it('conserva el orden del repository (por nombre)', async () => {
    const resultado = await service.disponibles(QUERY)
    expect(resultado.map((aula) => aula.nombre)).toEqual(['Aula 1', 'Aula 2', 'Aula 3'])
  })

  it('ninguna libre → [] (no es un error)', async () => {
    bloquesRepository.aulasOcupadas.mockResolvedValue([1, 2, 3])

    await expect(service.disponibles(QUERY)).resolves.toEqual([])
  })

  it('pasa excluirBloqueId, para que la fila que se edita no ocupe su aula', async () => {
    await service.disponibles({ ...QUERY, horaFin: '15:00', excluirBloqueId: 10 })

    expect(bloquesRepository.aulasOcupadas).toHaveBeenCalledWith({
      diaSemana: 1,
      horasPedidas: [840],
      excluirBloqueId: 10,
    })
  })

  it('un aula inactiva no se ofrece aunque esté libre', async () => {
    repository.listar.mockResolvedValue([
      { id: 1, nombre: 'Aula 1', capacidad: 8, estado: 'ACTIVO' },
      { id: 4, nombre: 'Aula 4', capacidad: 20, estado: 'INACTIVO' },
    ])

    const resultado = await service.disponibles(QUERY)

    expect(resultado).toEqual([{ id: 1, nombre: 'Aula 1', capacidad: 8 }])
  })
})
