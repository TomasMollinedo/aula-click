import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { Adeudado, Ocurrencia } from '../cuentas.condiciones'
import type { CuentasRepository } from '../cuentas.repository'
import { crearCuentasService } from '../cuentas.service'

// Service de cuentas (T-53) con el repository mockeado y reloj fijo: lunes 05/10/2026 al mediodía
// en Salta. Qué adeuda y qué es próximo se prueba en `cuentas.reglas` y `cuentas.condiciones`;
// acá, lo del service: el 404, `hoy` y el día 1 del mes, los DTOs, el total y la página.

const reloj = () => new Date('2026-10-05T15:00:00Z')
const HOY = '2026-10-05'

function adeudado(parcial: {
  turnoId?: number
  fecha: string
  alumnoId?: number
  estado?: Ocurrencia['estado']
  importe?: number | null
}): Adeudado {
  const alumnoId = parcial.alumnoId ?? 12
  return {
    ocurrencia: {
      turnoId: parcial.turnoId ?? 41,
      fecha: parcial.fecha,
      bloqueAgendaId: 10,
      diaSemana: 1,
      horaInicio: 540,
      horaFin: 600,
      profesorId: 3,
      aulaId: 1,
      alumnoId,
      materiaId: 2,
      tipo: 'RECURRENTE',
      estado: parcial.estado ?? 'SIN_REGISTRAR',
      pago: { estado: 'PENDIENTE' },
      serie: { fechaInicio: '2026-09-07', fechaFin: null, finEfectivo: null },
      alumno: { id: alumnoId, nombre: `Alumno${alumnoId}`, apellido: 'Paz', busqueda: 'paz' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez', busqueda: 'gomez ana' },
      materia: { id: 2, nombre: 'Matemática' },
      aula: { id: 1, nombre: 'Aula 1' },
    },
    importe: parcial.importe === undefined ? 8000 : parcial.importe,
  }
}

const historial = [
  { pagoId: 31, numeroComprobante: 1024, fechaPago: '2026-10-01', cantidad: 4, total: 32000 },
  { pagoId: 18, numeroComprobante: 1011, fechaPago: '2026-09-02', cantidad: 2, total: 16000 },
]

let repository: {
  [K in keyof CuentasRepository]: ReturnType<typeof vi.fn<CuentasRepository[K]>>
}
let alumnosRepository: { buscarPorId: ReturnType<typeof vi.fn<AlumnosRepository['buscarPorId']>> }
let service: ReturnType<typeof crearCuentasService>

beforeEach(() => {
  repository = {
    leerAdeudados: vi.fn<CuentasRepository['leerAdeudados']>().mockResolvedValue([]),
    leerProximos: vi.fn<CuentasRepository['leerProximos']>().mockResolvedValue([]),
    sumarPagos: vi.fn<CuentasRepository['sumarPagos']>().mockResolvedValue(0),
    listarPagos: vi.fn<CuentasRepository['listarPagos']>().mockResolvedValue([]),
    dnisDeAlumnos: vi
      .fn<CuentasRepository['dnisDeAlumnos']>()
      .mockImplementation(async (ids) => new Map(ids.map((id) => [id, `50${id}000`]))),
  }
  alumnosRepository = {
    buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>().mockResolvedValue({
      id: 12,
    } as Awaited<ReturnType<AlumnosRepository['buscarPorId']>>),
  }
  service = crearCuentasService({ repository, alumnosRepository, reloj })
})

describe('obtenerCuenta', () => {
  it('alumno inexistente → 404 sin leer la cuenta', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)

    await expect(service.obtenerCuenta(99)).rejects.toBeInstanceOf(NotFoundError)
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
  })

  it('alumno sin nada: totales en 0 y listas vacías', async () => {
    expect(await service.obtenerCuenta(12)).toEqual({
      totalAdeudado: 0,
      pagadoDelMes: 0,
      adeudados: [],
      proximos: [],
      pagos: [],
    })
  })

  it('lee con hoy del reloj; pagado del mes del día 1 del mes a hoy', async () => {
    await service.obtenerCuenta(12)

    expect(repository.leerAdeudados).toHaveBeenCalledWith({ alumnoId: 12, hoy: HOY })
    expect(repository.leerProximos).toHaveBeenCalledWith({ alumnoId: 12, hoy: HOY })
    expect(repository.sumarPagos).toHaveBeenCalledWith(12, '2026-10-01', HOY)
    expect(repository.listarPagos).toHaveBeenCalledWith(12)
  })

  it('arma los DTOs campo por campo (HH:mm, estado, importe null) sin campos internos', async () => {
    repository.leerAdeudados.mockResolvedValue([adeudado({ fecha: '2026-09-28', importe: null })])
    repository.leerProximos.mockResolvedValue([adeudado({ fecha: HOY, estado: 'AGENDADO' })])

    const cuenta = await service.obtenerCuenta(12)

    const esperado = {
      turnoId: 41,
      horaInicio: '09:00',
      horaFin: '10:00',
      materia: { id: 2, nombre: 'Matemática' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
    }
    expect(cuenta.adeudados).toEqual([
      { ...esperado, fecha: '2026-09-28', estado: 'SIN_REGISTRAR', importe: null },
    ])
    expect(cuenta.proximos).toEqual([
      { ...esperado, fecha: HOY, estado: 'AGENDADO', importe: 8000 },
    ])
    expect(JSON.stringify(cuenta)).not.toContain('busqueda')
  })

  it('totalAdeudado exacto en centavos (3 × 10.000,50); los próximos no suman', async () => {
    repository.leerAdeudados.mockResolvedValue(
      ['2026-09-14', '2026-09-21', '2026-09-28'].map((fecha) =>
        adeudado({ fecha, importe: 10000.5 }),
      ),
    )
    repository.leerProximos.mockResolvedValue([adeudado({ fecha: HOY, estado: 'AGENDADO' })])

    expect((await service.obtenerCuenta(12)).totalAdeudado).toBe(30001.5)
  })

  it('el historial y pagadoDelMes pasan tal cual', async () => {
    repository.sumarPagos.mockResolvedValue(32000)
    repository.listarPagos.mockResolvedValue(historial)

    const cuenta = await service.obtenerCuenta(12)

    expect(cuenta.pagadoDelMes).toBe(32000)
    expect(cuenta.pagos).toEqual(historial)
  })
})

describe('listarAdeudados', () => {
  // Cinco adeudados de dos alumnos, ya ordenados como los devuelve la condición.
  const cinco = [
    adeudado({ fecha: '2026-09-07', importe: 10000.5 }),
    adeudado({ turnoId: 57, fecha: '2026-09-08', alumnoId: 15, importe: 9000 }),
    adeudado({ fecha: '2026-09-14', importe: 10000.5 }),
    adeudado({ turnoId: 57, fecha: '2026-09-15', alumnoId: 15, importe: null }),
    adeudado({ fecha: '2026-09-21', importe: 10000.5 }),
  ]

  beforeEach(() => {
    repository.leerAdeudados.mockResolvedValue(cinco)
  })

  it('sin filtro: lee todos con hoy del reloj y no busca alumno', async () => {
    await service.listarAdeudados({ page: 1, pageSize: 20 })

    expect(repository.leerAdeudados).toHaveBeenCalledWith({ alumnoId: undefined, hoy: HOY })
    expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
  })

  it('con alumnoId inexistente → 404 sin leer la deuda', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)

    await expect(
      service.listarAdeudados({ page: 1, pageSize: 20, alumnoId: 99 }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
  })

  it('página 2 en el orden de la condición, con el alumno y su DNI', async () => {
    const res = await service.listarAdeudados({ page: 2, pageSize: 2 })

    expect(res.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 })
    expect(res.data.map((a) => [a.turnoId, a.fecha])).toEqual([
      [41, '2026-09-14'],
      [57, '2026-09-15'],
    ])
    expect(res.data[1]?.alumno).toEqual({
      id: 15,
      nombre: 'Alumno15',
      apellido: 'Paz',
      dni: '5015000',
    })
    expect(repository.dnisDeAlumnos).toHaveBeenCalledWith([12, 15])
  })

  it('totalAdeudado es el de todas las páginas, no el de la página', async () => {
    const paginas = await Promise.all(
      [1, 2, 3].map((page) => service.listarAdeudados({ page, pageSize: 2 })),
    )

    // 3 × 10.000,50 + 9.000 (el null no suma).
    for (const pagina of paginas) expect(pagina.totalAdeudado).toBe(39001.5)
    const suma = paginas
      .flatMap((p) => p.data)
      .reduce((total, a) => total + Math.round((a.importe ?? 0) * 100), 0)
    expect(suma / 100).toBe(39001.5)
  })

  it('página fuera de rango: vacía, con el meta y el total correctos', async () => {
    expect(await service.listarAdeudados({ page: 9, pageSize: 2 })).toEqual({
      data: [],
      meta: { page: 9, pageSize: 2, total: 5, totalPages: 3 },
      totalAdeudado: 39001.5,
    })
  })

  it('con alumnoId existente filtra por ese alumno', async () => {
    await service.listarAdeudados({ page: 1, pageSize: 20, alumnoId: 12 })

    expect(alumnosRepository.buscarPorId).toHaveBeenCalledWith(12)
    expect(repository.leerAdeudados).toHaveBeenCalledWith({ alumnoId: 12, hoy: HOY })
  })
})
