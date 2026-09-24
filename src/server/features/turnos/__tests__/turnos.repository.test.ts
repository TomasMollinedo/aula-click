import { beforeEach, describe, expect, it, vi } from 'vitest'
import { condicionTurnoVigente, turnosRepository } from '../turnos.repository'

// Única implementación de "turno vigente" (docs/dominio.md → Turnos). Sin base: Prisma se
// reemplaza por un mock y se verifica la condición que recibe. Que Postgres la evalúe bien lo
// garantiza el `gte` sobre una columna @db.Date.

const { groupBy, count, findMany } = vi.hoisted(() => ({
  groupBy: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { turno: { groupBy, count, findMany } } }))

const HOY = '2026-09-22'
const MEDIANOCHE_HOY = new Date('2026-09-22T00:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  groupBy.mockResolvedValue([])
  count.mockResolvedValue(0)
  findMany.mockResolvedValue([])
})

describe('condicionTurnoVigente', () => {
  it('solo turnos ACTIVO (un cancelado no cuenta)', () => {
    expect(condicionTurnoVigente(HOY).estado).toBe('ACTIVO')
  })

  it('recurrente sin fecha de fin, o con fin >= hoy (incluye el que termina exactamente hoy)', () => {
    expect(condicionTurnoVigente(HOY).OR).toEqual([
      { fechaFin: null },
      { fechaFin: { gte: MEDIANOCHE_HOY } },
    ])
  })

  it('una sesión única (fechaFin = fechaInicio) de hoy cumple fin >= hoy; la de ayer no', () => {
    const { gte } = condicionTurnoVigente(HOY).OR[1].fechaFin as { gte: Date }
    expect(new Date('2026-09-22T00:00:00.000Z') >= gte).toBe(true)
    expect(new Date('2026-09-21T00:00:00.000Z') >= gte).toBe(false)
  })
})

describe('contarVigentesPorMateria', () => {
  it('filtra por profesor (el del bloque) y materias, agrupa por materia y devuelve la cantidad', async () => {
    groupBy.mockResolvedValue([
      { materiaId: 2, _count: { _all: 3 } },
      { materiaId: 7, _count: { _all: 1 } },
    ])

    const resultado = await turnosRepository.contarVigentesPorMateria({
      fechaHoy: HOY,
      profesorId: 3,
      materiaIds: [2, 7],
    })

    expect(resultado).toEqual([
      { materiaId: 2, cantidad: 3 },
      { materiaId: 7, cantidad: 1 },
    ])
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['materiaId'],
        where: {
          ...condicionTurnoVigente(HOY),
          bloqueAgenda: { profesorId: 3 },
          materiaId: { in: [2, 7] },
        },
      }),
    )
  })

  it('sin filtros opcionales, cuenta todos los vigentes', async () => {
    await turnosRepository.contarVigentesPorMateria({ fechaHoy: HOY })

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: condicionTurnoVigente(HOY) }),
    )
  })
})

describe('contarVigentesPorBloque', () => {
  it('cuenta los turnos vigentes de ese bloque puntual', async () => {
    count.mockResolvedValue(2)

    const resultado = await turnosRepository.contarVigentesPorBloque(10, HOY)

    expect(resultado).toBe(2)
    expect(count).toHaveBeenCalledWith({
      where: { ...condicionTurnoVigente(HOY), bloqueAgendaId: 10 },
    })
  })
})

describe('listarVigentesPorProfesor', () => {
  it('trae alumno, materia, fecha y horario de cada turno vigente del profesor', async () => {
    findMany.mockResolvedValue([
      {
        alumno: { id: 12, nombre: 'Lucía', apellido: 'González' },
        materia: { id: 2, nombre: 'Matemática' },
        fechaInicio: new Date('2026-09-25T00:00:00.000Z'),
        bloqueAgenda: { horaInicio: 540, horaFin: 600 },
      },
    ])

    const resultado = await turnosRepository.listarVigentesPorProfesor(3, HOY)

    expect(resultado).toEqual([
      {
        alumno: { id: 12, nombre: 'Lucía', apellido: 'González' },
        materia: { id: 2, nombre: 'Matemática' },
        fecha: '2026-09-25',
        horaInicio: '09:00',
        horaFin: '10:00',
      },
    ])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...condicionTurnoVigente(HOY), bloqueAgenda: { profesorId: 3 } },
      }),
    )
  })

  it('sin turnos vigentes, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarVigentesPorProfesor(3, HOY)).resolves.toEqual([])
  })
})
