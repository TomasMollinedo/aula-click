import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ClienteExamenes,
  type PedidoPrioridad,
  clavePrioridad,
  leerExamenesDelPeriodo,
  leerPrioridades,
  prioridadPorDias,
} from '../examenes.condiciones'

// Regla de la prioridad (HU-18) y su lectura por lote. Sin base: el cliente es un falso que aplica
// el `where` de la consulta sobre una tabla de ejemplo, así se prueba también el filtro en memoria.

interface FilaExamen {
  id: number
  alumnoId: number
  materiaId: number
  fecha: string
  estado: 'ACTIVO' | 'INACTIVO'
}

interface WhereExamen {
  estado: string
  alumnoId: { in: number[] }
  materiaId: { in: number[] }
  fecha: { gte: Date }
}

const MATERIAS: Record<number, string> = { 10: 'Matemática', 20: 'Física' }

let tabla: FilaExamen[] = []

const findMany = vi.fn(({ where }: { where: WhereExamen }) =>
  Promise.resolve(
    tabla
      .map((fila) => ({ ...fila, fecha: new Date(`${fila.fecha}T00:00:00Z`) }))
      .filter(
        (fila) =>
          fila.estado === where.estado &&
          where.alumnoId.in.includes(fila.alumnoId) &&
          where.materiaId.in.includes(fila.materiaId) &&
          fila.fecha >= where.fecha.gte,
      )
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id - b.id)
      .map((fila) => ({
        id: fila.id,
        alumnoId: fila.alumnoId,
        materiaId: fila.materiaId,
        fecha: fila.fecha,
        materia: { nombre: MATERIAS[fila.materiaId] },
      })),
  ),
)

const client = { examen: { findMany } } as unknown as ClienteExamenes

function examen(fila: Partial<FilaExamen> & Pick<FilaExamen, 'id' | 'fecha'>): FilaExamen {
  return { alumnoId: 1, materiaId: 10, estado: 'ACTIVO', ...fila }
}

const TURNO: PedidoPrioridad = { alumnoId: 1, materiaId: 10, fecha: '2026-10-05' }

async function prioridadDe(item: PedidoPrioridad = TURNO) {
  const mapa = await leerPrioridades(client, [item])
  return mapa.get(clavePrioridad(item))
}

beforeEach(() => {
  tabla = []
  findMany.mockClear()
})

describe('prioridadPorDias', () => {
  it('de 0 a 10 días es ALTA', () => {
    expect(prioridadPorDias(0)).toBe('ALTA')
    expect(prioridadPorDias(10)).toBe('ALTA')
  })

  it('de 11 a 20 días es MEDIA', () => {
    expect(prioridadPorDias(11)).toBe('MEDIA')
    expect(prioridadPorDias(20)).toBe('MEDIA')
  })

  it('más de 20 días o sin examen es BAJA', () => {
    expect(prioridadPorDias(21)).toBe('BAJA')
    expect(prioridadPorDias(null)).toBe('BAJA')
  })

  it('un negativo o un no entero lanza RangeError', () => {
    expect(() => prioridadPorDias(-1)).toThrow(RangeError)
    expect(() => prioridadPorDias(1.5)).toThrow(RangeError)
  })
})

describe('clavePrioridad', () => {
  it('es alumnoId-materiaId-fecha', () => {
    expect(clavePrioridad(TURNO)).toBe('1-10-2026-10-05')
  })
})

describe('leerPrioridades', () => {
  it('con el lote vacío devuelve un Map vacío y no consulta', async () => {
    const mapa = await leerPrioridades(client, [])

    expect(mapa.size).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('con una fecha inválida en cualquier ítem lanza RangeError y no consulta', async () => {
    await expect(
      leerPrioridades(client, [TURNO, { ...TURNO, fecha: '2026-02-30' }]),
    ).rejects.toThrow(RangeError)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('un examen el mismo día del turno es ALTA y trae el examen completo', async () => {
    tabla = [examen({ id: 7, fecha: '2026-10-05' })]

    expect(await prioridadDe()).toStrictEqual({
      prioridad: 'ALTA',
      examen: { id: 7, fecha: '2026-10-05', materiaNombre: 'Matemática', dias: 0 },
    })
  })

  it('sin examen es BAJA y no trae examen', async () => {
    expect(await prioridadDe()).toStrictEqual({ prioridad: 'BAJA' })
  })

  it('un examen anterior al turno no cuenta', async () => {
    // El turno del 28/09 hace que la consulta traiga el examen del 01/10; el del 05/10 no lo usa.
    tabla = [examen({ id: 1, fecha: '2026-10-01' })]
    const anterior = { ...TURNO, fecha: '2026-09-28' }

    const mapa = await leerPrioridades(client, [anterior, TURNO])

    expect(mapa.get(clavePrioridad(anterior))?.prioridad).toBe('ALTA')
    expect(mapa.get(clavePrioridad(TURNO))).toStrictEqual({ prioridad: 'BAJA' })
  })

  it('un examen dado de baja no cuenta', async () => {
    tabla = [examen({ id: 1, fecha: '2026-10-06', estado: 'INACTIVO' })]

    expect(await prioridadDe()).toStrictEqual({ prioridad: 'BAJA' })
  })

  it('un examen de otro alumno no cuenta, aunque la consulta lo traiga', async () => {
    // El `in × in` de (1, 2) × (10, 20) trae (2, 10) y (1, 20), que no se pidieron.
    tabla = [
      examen({ id: 1, alumnoId: 2, materiaId: 10, fecha: '2026-10-06' }),
      examen({ id: 2, alumnoId: 1, materiaId: 20, fecha: '2026-10-06' }),
    ]
    const otro = { alumnoId: 2, materiaId: 20, fecha: '2026-10-05' }

    const mapa = await leerPrioridades(client, [TURNO, otro])

    expect(mapa.get(clavePrioridad(TURNO))).toStrictEqual({ prioridad: 'BAJA' })
    expect(mapa.get(clavePrioridad(otro))).toStrictEqual({ prioridad: 'BAJA' })
  })

  it('con dos exámenes futuros toma el más cercano', async () => {
    tabla = [examen({ id: 1, fecha: '2026-10-20' }), examen({ id: 2, fecha: '2026-10-12' })]

    const resultado = await prioridadDe()

    expect(resultado?.prioridad).toBe('ALTA')
    expect(resultado?.examen).toMatchObject({ id: 2, fecha: '2026-10-12', dias: 7 })
  })

  it('en una serie, el mismo examen da prioridades distintas a cada turno', async () => {
    tabla = [examen({ id: 1, fecha: '2026-10-20' })]
    const siguiente = { ...TURNO, fecha: '2026-10-12' }

    const mapa = await leerPrioridades(client, [TURNO, siguiente])

    expect(mapa.get(clavePrioridad(TURNO))?.prioridad).toBe('MEDIA')
    expect(mapa.get(clavePrioridad(TURNO))?.examen?.dias).toBe(15)
    expect(mapa.get(clavePrioridad(siguiente))?.prioridad).toBe('ALTA')
    expect(mapa.get(clavePrioridad(siguiente))?.examen?.dias).toBe(8)
  })

  it('un examen a 25 días es BAJA pero trae el examen (no hay tope superior)', async () => {
    tabla = [examen({ id: 1, fecha: '2026-10-30' })]

    const resultado = await prioridadDe()

    expect(resultado?.prioridad).toBe('BAJA')
    expect(resultado?.examen).toMatchObject({ id: 1, fecha: '2026-10-30', dias: 25 })
  })

  it('cuenta los días a través de un cambio de mes', async () => {
    tabla = [examen({ id: 1, fecha: '2026-11-04' })]
    const turno = { ...TURNO, fecha: '2026-10-25' }

    const resultado = await prioridadDe(turno)

    expect(resultado?.prioridad).toBe('ALTA')
    expect(resultado?.examen?.dias).toBe(10)
  })

  it('un lote de varios ítems hace una sola consulta, con el where exacto', async () => {
    const items: PedidoPrioridad[] = [
      { alumnoId: 1, materiaId: 10, fecha: '2026-10-12' },
      { alumnoId: 2, materiaId: 20, fecha: '2026-10-05' },
      { alumnoId: 1, materiaId: 20, fecha: '2026-10-19' },
      { alumnoId: 1, materiaId: 10, fecha: '2026-10-12' },
    ]

    const mapa = await leerPrioridades(client, items)

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith({
      where: {
        estado: 'ACTIVO',
        alumnoId: { in: [1, 2] },
        materiaId: { in: [10, 20] },
        fecha: { gte: new Date('2026-10-05T00:00:00Z') },
      },
      select: {
        id: true,
        alumnoId: true,
        materiaId: true,
        fecha: true,
        materia: { select: { nombre: true } },
      },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    })
    // Una entrada por ítem; los duplicados comparten clave.
    expect([...mapa.keys()]).toEqual(['1-10-2026-10-12', '2-20-2026-10-05', '1-20-2026-10-19'])
  })

  it('si cambia la tabla, cambia el resultado (no se persiste)', async () => {
    tabla = [examen({ id: 1, fecha: '2026-10-08' })]
    expect((await prioridadDe())?.prioridad).toBe('ALTA')

    tabla = [examen({ id: 1, fecha: '2026-10-08', estado: 'INACTIVO' })]
    expect(await prioridadDe()).toStrictEqual({ prioridad: 'BAJA' })

    expect(findMany).toHaveBeenCalledTimes(2)
  })
})

describe('leerExamenesDelPeriodo', () => {
  const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
  const decimal = (n: number) => ({ toNumber: () => n })

  function clienteCon(filas: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(filas)
    return { findMany, client: { examen: { findMany } } as unknown as ClienteExamenes }
  }

  it('una consulta con el período, el alumno y las materias; devuelve la nota como número', async () => {
    const { client, findMany } = clienteCon([
      {
        id: 1,
        materiaId: 10,
        fecha: fecha('2026-09-05'),
        resultado: 'CON_NOTA',
        nota: decimal(7.5),
        materia: { nombre: 'Matemática' },
      },
      {
        id: 2,
        materiaId: 10,
        fecha: fecha('2026-09-20'),
        resultado: 'AUSENTE',
        nota: null,
        materia: { nombre: 'Matemática' },
      },
    ])

    const examenes = await leerExamenesDelPeriodo(client, {
      alumnoId: 12,
      desde: '2026-09-01',
      hasta: '2026-09-30',
      materiaIds: [10],
    })

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      estado: 'ACTIVO',
      alumnoId: 12,
      fecha: { gte: fecha('2026-09-01'), lte: fecha('2026-09-30') },
      materiaId: { in: [10] },
    })
    expect(examenes).toEqual([
      {
        id: 1,
        materiaId: 10,
        materiaNombre: 'Matemática',
        fecha: '2026-09-05',
        resultado: 'CON_NOTA',
        nota: 7.5,
      },
      {
        id: 2,
        materiaId: 10,
        materiaNombre: 'Matemática',
        fecha: '2026-09-20',
        resultado: 'AUSENTE',
        nota: null,
      },
    ])
  })

  it('sin materiaIds no filtra por materia', async () => {
    const { client, findMany } = clienteCon([])

    await leerExamenesDelPeriodo(client, { alumnoId: 12, desde: '2026-09-01', hasta: '2026-09-30' })

    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty('materiaId')
  })

  it('una fecha inválida lanza RangeError antes de consultar', async () => {
    const { client, findMany } = clienteCon([])

    await expect(
      leerExamenesDelPeriodo(client, { alumnoId: 12, desde: '2026-02-30', hasta: '2026-03-01' }),
    ).rejects.toBeInstanceOf(RangeError)
    expect(findMany).not.toHaveBeenCalled()
  })
})
