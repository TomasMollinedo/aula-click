import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  condicionTurnoEnFecha,
  condicionTurnoOcupaLugar,
  condicionTurnoVigente,
  turnosRepository,
} from '../turnos.repository'

// Única implementación de "turno vigente" (docs/dominio.md → Turnos). Sin base: Prisma se
// reemplaza por un mock y se verifica la condición que recibe. Que Postgres la evalúe bien lo
// garantiza el `gte` sobre una columna @db.Date.

const { groupBy, count, findMany, materiaFindMany, aulaFindMany, $transaction } = vi.hoisted(
  () => ({
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    materiaFindMany: vi.fn(),
    aulaFindMany: vi.fn(),
    // Emula la forma "arreglo" de $transaction: ejecuta las consultas ya lanzadas por los mocks.
    $transaction: vi.fn((operaciones: Promise<unknown>[]) => Promise.all(operaciones)),
  }),
)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    turno: { groupBy, count, findMany },
    materia: { findMany: materiaFindMany },
    aula: { findMany: aulaFindMany },
    $transaction,
  },
}))

const HOY = '2026-09-22'
const MEDIANOCHE_HOY = new Date('2026-09-22T00:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  groupBy.mockResolvedValue([])
  count.mockResolvedValue(0)
  findMany.mockResolvedValue([])
  materiaFindMany.mockResolvedValue([])
  aulaFindMany.mockResolvedValue([])
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

describe('condicionTurnoOcupaLugar', () => {
  it('solo turnos ACTIVO (un cancelado libera su lugar) de exactamente esa fecha', () => {
    expect(condicionTurnoOcupaLugar(HOY)).toEqual({
      estado: 'ACTIVO',
      fechaInicio: MEDIANOCHE_HOY,
    })
  })
})

describe('contarVigentesPorBloques', () => {
  it('una sola consulta para todas las filas, con la condición de vigente, agrupada por fila', async () => {
    groupBy.mockResolvedValue([{ bloqueAgendaId: 11, _count: { _all: 2 } }])

    const resultado = await turnosRepository.contarVigentesPorBloques([10, 11], HOY)

    expect(resultado).toEqual([{ bloqueAgendaId: 11, cantidad: 2 }])
    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bloqueAgendaId'],
        where: { ...condicionTurnoVigente(HOY), bloqueAgendaId: { in: [10, 11] } },
      }),
    )
  })
})

describe('contarOcupacionPorBloque', () => {
  it('una sola consulta con un OR de pares fila–fecha, y devuelve la fecha como YYYY-MM-DD', async () => {
    groupBy.mockResolvedValue([
      {
        bloqueAgendaId: 10,
        fechaInicio: new Date('2026-09-28T00:00:00.000Z'),
        _count: { _all: 3 },
      },
    ])

    const resultado = await turnosRepository.contarOcupacionPorBloque([
      { bloqueAgendaId: 10, fecha: '2026-09-28' },
      { bloqueAgendaId: 11, fecha: HOY },
    ])

    expect(resultado).toEqual([{ bloqueAgendaId: 10, fecha: '2026-09-28', cantidad: 3 }])
    expect(groupBy).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bloqueAgendaId', 'fechaInicio'],
        where: {
          OR: [
            { ...condicionTurnoOcupaLugar('2026-09-28'), bloqueAgendaId: 10 },
            { ...condicionTurnoOcupaLugar(HOY), bloqueAgendaId: 11 },
          ],
        },
      }),
    )
  })

  it('sin filas no consulta la base', async () => {
    expect(await turnosRepository.contarOcupacionPorBloque([])).toEqual([])
    expect(groupBy).not.toHaveBeenCalled()
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

describe('condicionTurnoEnFecha', () => {
  it('solo turnos ACTIVO, con fechaInicio <= fecha', () => {
    const condicion = condicionTurnoEnFecha(HOY)
    expect(condicion.estado).toBe('ACTIVO')
    expect(condicion.fechaInicio).toEqual({ lte: MEDIANOCHE_HOY })
  })

  it('fechaFin nula o >= fecha: cubre la sesión única (fechaInicio = fechaFin) y un rango', () => {
    expect(condicionTurnoEnFecha(HOY).OR).toEqual([
      { fechaFin: null },
      { fechaFin: { gte: MEDIANOCHE_HOY } },
    ])
  })
})

describe('listarAgenda', () => {
  function filaAgenda() {
    return {
      id: 15,
      estado: 'ACTIVO' as const,
      alumno: { id: 12, apellido: 'González', nombre: 'Lucía' },
      materia: { id: 2, nombre: 'Matemática' },
      bloqueAgenda: {
        horaInicio: 540,
        horaFin: 600,
        aula: { id: 1, nombre: 'Aula 1' },
        profesor: { id: 3, usuario: { apellido: 'Pérez', nombre: 'Ana' } },
      },
    }
  }

  it('arma el item con profesor, materia, aula y horario en HH:mm', async () => {
    findMany.mockResolvedValue([filaAgenda()])
    count.mockResolvedValue(1)

    const resultado = await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    expect(resultado).toEqual({
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
    })
  })

  it('filtra por el día de la semana de la fecha, sin filtros opcionales ni búsqueda', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    // 2026-09-22 es martes: diaSemanaISO = 2.
    const whereEsperado = {
      AND: [condicionTurnoEnFecha(HOY), { bloqueAgenda: { diaSemana: 2 } }],
    }
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: whereEsperado }))
    expect(count).toHaveBeenCalledWith({ where: whereEsperado })
  })

  it('combina los filtros de materia y aula en la segunda rama del AND', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      materiaId: 2,
      aulaId: 1,
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            condicionTurnoEnFecha(HOY),
            { bloqueAgenda: { diaSemana: 2, aulaId: 1 }, materiaId: 2 },
          ],
        },
      }),
    )
  })

  it('sin `terminos`, el AND tiene solo dos ramas: no agrega ninguna de búsqueda', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20, terminos: [] })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND).toHaveLength(2)
  })

  it('con `terminos`, agrega una tercera rama: todas las palabras en el alumno, o todas en el profesor', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      terminos: ['juan', 'gonz'],
    })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND).toHaveLength(3)
    expect(where.AND[2]).toEqual({
      OR: [
        {
          alumno: {
            AND: [{ busqueda: { contains: 'juan' } }, { busqueda: { contains: 'gonz' } }],
          },
        },
        {
          bloqueAgenda: {
            profesor: {
              usuario: {
                AND: [{ busqueda: { contains: 'juan' } }, { busqueda: { contains: 'gonz' } }],
              },
            },
          },
        },
      ],
    })
  })

  it('la condición de vigencia por fecha (fechaFin nula o >= fecha) se mantiene con `terminos`', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      terminos: ['juan'],
    })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND[0]).toEqual(condicionTurnoEnFecha(HOY))
  })

  it('filtra por profesorId (vista personal): va en la misma rama que aula y día de semana', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20, profesorId: 3 })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [condicionTurnoEnFecha(HOY), { bloqueAgenda: { diaSemana: 2, profesorId: 3 } }],
        },
      }),
    )
  })

  it('con profesorId y `terminos`, la búsqueda es solo por alumno (sin OR por profesor)', async () => {
    await turnosRepository.listarAgenda({
      fecha: HOY,
      page: 1,
      pageSize: 20,
      profesorId: 3,
      terminos: ['juan'],
    })

    const { where } = findMany.mock.calls[0][0] as { where: { AND: unknown[] } }
    expect(where.AND).toHaveLength(3)
    expect(where.AND[2]).toEqual({ alumno: { AND: [{ busqueda: { contains: 'juan' } }] } })
  })

  it('ordena por hora, dentro de la hora por profesor, y por id como desempate final', async () => {
    await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { bloqueAgenda: { horaInicio: 'asc' } },
          { bloqueAgenda: { profesor: { usuario: { busqueda: 'asc' } } } },
          { id: 'asc' },
        ],
      }),
    )
  })

  it('pagina con calcularSkipTake y arma meta con armarMeta', async () => {
    count.mockResolvedValue(45)

    const resultado = await turnosRepository.listarAgenda({ fecha: HOY, page: 2, pageSize: 20 })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }))
    expect(resultado.meta).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 })
  })

  it('sin turnos ese día, devuelve una página vacía', async () => {
    const resultado = await turnosRepository.listarAgenda({ fecha: HOY, page: 1, pageSize: 20 })

    expect(resultado).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })
  })
})

describe('listarMateriasConTurno', () => {
  it('devuelve las materias que trae Prisma, tal cual', async () => {
    materiaFindMany.mockResolvedValue([
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ])

    await expect(turnosRepository.listarMateriasConTurno(HOY)).resolves.toEqual([
      { id: 2, nombre: 'Matemática' },
      { id: 7, nombre: 'Física' },
    ])
  })

  it('filtra materias con algún turno que aplica esa fecha, en el día de semana del bloque', async () => {
    await turnosRepository.listarMateriasConTurno(HOY)

    // 2026-09-22 es martes: diaSemanaISO = 2.
    expect(materiaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          turnos: { some: { ...condicionTurnoEnFecha(HOY), bloqueAgenda: { diaSemana: 2 } } },
        },
      }),
    )
  })

  it('no filtra por el estado de la materia: importa si se dictó esa fecha, no si sigue activa', async () => {
    await turnosRepository.listarMateriasConTurno(HOY)

    const { where } = materiaFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where).not.toHaveProperty('estado')
  })

  it('sin materias con turno ese día, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarMateriasConTurno(HOY)).resolves.toEqual([])
  })
})

describe('listarAulasConTurno', () => {
  it('devuelve las aulas que trae Prisma, tal cual', async () => {
    aulaFindMany.mockResolvedValue([
      { id: 1, nombre: 'Aula 1' },
      { id: 2, nombre: 'Aula 2' },
    ])

    await expect(turnosRepository.listarAulasConTurno(HOY)).resolves.toEqual([
      { id: 1, nombre: 'Aula 1' },
      { id: 2, nombre: 'Aula 2' },
    ])
  })

  it('filtra aulas con algún bloque en el día de semana con un turno que aplica esa fecha', async () => {
    await turnosRepository.listarAulasConTurno(HOY)

    // 2026-09-22 es martes: diaSemanaISO = 2.
    expect(aulaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          bloques: { some: { diaSemana: 2, turnos: { some: condicionTurnoEnFecha(HOY) } } },
        },
      }),
    )
  })

  it('no filtra por el estado del aula: importa si se usó esa fecha, no si sigue activa', async () => {
    await turnosRepository.listarAulasConTurno(HOY)

    const { where } = aulaFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(where).not.toHaveProperty('estado')
  })

  it('sin aulas con turno ese día, devuelve un arreglo vacío', async () => {
    await expect(turnosRepository.listarAulasConTurno(HOY)).resolves.toEqual([])
  })
})
