import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TurnosRepository } from '../turnos.repository'
import { crearTurnosService } from '../turnos.service'
import type { AgendaListado } from '../turnos.validation'

// El repository se reemplaza por un falso: sin Docker ni Postgres. El service lo importa solo
// como tipo, así que no hace falta mockear el módulo real.

// Mediodía del 22/09/2026 en Salta (UTC-3).
const HOY = '2026-09-22'
const relojFijo = () => new Date('2026-09-22T15:00:00Z')

const paginaVacia: AgendaListado = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
}

function crearRepository() {
  return {
    contarVigentesPorMateria: vi.fn<TurnosRepository['contarVigentesPorMateria']>(),
    contarVigentesPorBloque: vi.fn<TurnosRepository['contarVigentesPorBloque']>(),
    listarVigentesPorProfesor: vi.fn<TurnosRepository['listarVigentesPorProfesor']>(),
    contarVigentesPorBloques: vi.fn<TurnosRepository['contarVigentesPorBloques']>(),
    contarOcupacionPorBloque: vi.fn<TurnosRepository['contarOcupacionPorBloque']>(),
    listarAgenda: vi.fn<TurnosRepository['listarAgenda']>(),
  }
}

let repository: ReturnType<typeof crearRepository>
let service: ReturnType<typeof crearTurnosService>

beforeEach(() => {
  repository = crearRepository()
  repository.listarAgenda.mockResolvedValue(paginaVacia)
  service = crearTurnosService({ repository, reloj: relojFijo })
})

describe('listarAgenda', () => {
  it('sin fecha, consulta la de hoy según el reloj del service', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20 })

    expect(repository.listarAgenda).toHaveBeenCalledWith({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      materiaId: undefined,
      aulaId: undefined,
      profesorId: undefined,
      alumnoId: undefined,
    })
  })

  it('con fecha, la respeta en lugar de la de hoy', async () => {
    await service.listarAgenda({ page: 1, pageSize: 20, fecha: '2026-09-28' })

    expect(repository.listarAgenda).toHaveBeenCalledWith(
      expect.objectContaining({ fecha: '2026-09-28' }),
    )
  })

  it('pasa la paginación y los filtros de materia, aula, profesor y alumno tal cual', async () => {
    await service.listarAgenda({
      page: 2,
      pageSize: 10,
      materiaId: 2,
      aulaId: 1,
      profesorId: 3,
      alumnoId: 12,
    })

    expect(repository.listarAgenda).toHaveBeenCalledWith({
      fecha: HOY,
      page: 2,
      pageSize: 10,
      materiaId: 2,
      aulaId: 1,
      profesorId: 3,
      alumnoId: 12,
    })
  })

  it('devuelve la página tal como la arma el repository', async () => {
    const pagina: AgendaListado = {
      data: [
        {
          id: 15,
          alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
          profesor: { id: 3, apellido: 'Pérez', nombre: 'Ana' },
          materia: { id: 2, nombre: 'Matemática' },
          aula: { id: 1, nombre: 'Aula 1' },
          horaInicio: '09:00',
          horaFin: '10:00',
          estado: 'ACTIVO',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }
    repository.listarAgenda.mockResolvedValue(pagina)

    await expect(service.listarAgenda({ page: 1, pageSize: 20 })).resolves.toEqual(pagina)
  })
})
