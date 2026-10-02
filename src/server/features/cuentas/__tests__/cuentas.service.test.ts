import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { Adeudado, Ocurrencia } from '../cuentas.condiciones'
import type { CuentasRepository } from '../cuentas.repository'
import { crearCuentasService } from '../cuentas.service'

// Service de cuentas (T-53) con el repository mockeado y reloj fijo: lunes 05/10/2026 al mediodía
// en Salta (ayer, 04/10; tope de cobro, hoy + 56 = 30/11). Qué adeuda, qué es próximo y el recorte
// del período se prueban en `cuentas.reglas` y `cuentas.condiciones`; acá, lo del service: el 404,
// `hoy`, qué sección aplica (y que la que no aplica no se lee), los DTOs, el total y la página.

const reloj = () => new Date('2026-10-05T15:00:00Z')
const HOY = '2026-10-05'
const TOPE = '2026-11-30'

const PERIODO_PASADO = { desde: '2026-09-01', hasta: '2026-09-30' }
const PERIODO_FUTURO = { desde: '2026-10-12', hasta: '2026-10-31' }
const PERIODO_QUE_CRUZA_HOY = { desde: '2026-09-21', hasta: '2026-10-19' }
const PERIODO_DESPUES_DEL_TOPE = { desde: '2026-12-01', hasta: '2026-12-31' }

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
      serie: { serieId: null, fechaInicio: '2026-09-07', fechaFin: null, finEfectivo: null },
      alumno: { id: alumnoId, nombre: `Alumno${alumnoId}`, apellido: 'Paz', busqueda: 'paz' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez', busqueda: 'gomez ana' },
      materia: { id: 2, nombre: 'Matemática' },
      aula: { id: 1, nombre: 'Aula 1' },
    },
    importe: parcial.importe === undefined ? 8000 : parcial.importe,
  }
}

const proximo = (parcial: Parameters<typeof adeudado>[0]) =>
  adeudado({ estado: 'AGENDADO', ...parcial })

let repository: {
  [K in keyof CuentasRepository]: ReturnType<typeof vi.fn<CuentasRepository[K]>>
}
let alumnosRepository: { buscarPorId: ReturnType<typeof vi.fn<AlumnosRepository['buscarPorId']>> }
let service: ReturnType<typeof crearCuentasService>

beforeEach(() => {
  repository = {
    leerAdeudados: vi.fn<CuentasRepository['leerAdeudados']>().mockResolvedValue([]),
    leerProximos: vi.fn<CuentasRepository['leerProximos']>().mockResolvedValue([]),
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
    expect(repository.leerProximos).not.toHaveBeenCalled()
  })

  it('sin filtros y sin nada: total en 0, listas vacías y el tope; sin `pagos` ni `pagadoDelMes`', async () => {
    const cuenta = await service.obtenerCuenta(12)

    expect(cuenta).toEqual({ totalAdeudado: 0, adeudados: [], proximos: [], limiteCobro: TOPE })
    expect(Object.keys(cuenta).sort()).toEqual([
      'adeudados',
      'limiteCobro',
      'proximos',
      'totalAdeudado',
    ])
  })

  it('sin filtros: lee las dos secciones con hoy del reloj', async () => {
    await service.obtenerCuenta(12)

    const filtro = {
      alumnoId: 12,
      materiaId: undefined,
      profesorId: undefined,
      desde: undefined,
      hasta: undefined,
      hoy: HOY,
    }
    expect(repository.leerAdeudados).toHaveBeenCalledWith(filtro)
    expect(repository.leerProximos).toHaveBeenCalledWith(filtro)
  })

  it('arma los DTOs campo por campo (HH:mm, estado, importe null) sin campos internos', async () => {
    repository.leerAdeudados.mockResolvedValue([adeudado({ fecha: '2026-09-28', importe: null })])
    repository.leerProximos.mockResolvedValue([proximo({ fecha: HOY })])

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
    repository.leerProximos.mockResolvedValue([proximo({ fecha: HOY })])

    expect((await service.obtenerCuenta(12)).totalAdeudado).toBe(30001.5)
  })

  it('período pasado: `proximos: null` sin leerlos y el total sólo del período', async () => {
    // Las condiciones devuelven sólo lo del período: el total es el de eso, no el de toda la deuda.
    repository.leerAdeudados.mockResolvedValue([
      adeudado({ fecha: '2026-09-14' }),
      adeudado({ fecha: '2026-09-21' }),
    ])

    const cuenta = await service.obtenerCuenta(12, PERIODO_PASADO)

    expect(repository.leerAdeudados).toHaveBeenCalledWith(
      expect.objectContaining({ alumnoId: 12, ...PERIODO_PASADO, hoy: HOY }),
    )
    expect(repository.leerProximos).not.toHaveBeenCalled()
    expect(cuenta.proximos).toBeNull()
    expect(cuenta.adeudados).toHaveLength(2)
    expect(cuenta.totalAdeudado).toBe(16000)
    expect(cuenta.limiteCobro).toBe(TOPE)
  })

  it('período futuro: `adeudados: null` sin leerlos y total 0, aunque haya próximos con importe', async () => {
    repository.leerProximos.mockResolvedValue([proximo({ fecha: '2026-10-12' })])

    const cuenta = await service.obtenerCuenta(12, PERIODO_FUTURO)

    expect(repository.leerAdeudados).not.toHaveBeenCalled()
    expect(repository.leerProximos).toHaveBeenCalledWith(
      expect.objectContaining({ alumnoId: 12, ...PERIODO_FUTURO, hoy: HOY }),
    )
    expect(cuenta.adeudados).toBeNull()
    expect(cuenta.totalAdeudado).toBe(0)
    expect(cuenta.proximos).toHaveLength(1)
  })

  it('`desde` igual a hoy: los adeudados no aplican; `hasta` igual a hoy: los próximos sí', async () => {
    expect((await service.obtenerCuenta(12, { desde: HOY })).adeudados).toBeNull()
    expect((await service.obtenerCuenta(12, { hasta: HOY })).proximos).toEqual([])
  })

  it('período que cruza hoy: las dos secciones aplican y reciben el período sin recortar', async () => {
    const cuenta = await service.obtenerCuenta(12, PERIODO_QUE_CRUZA_HOY)

    expect(cuenta).toMatchObject({ adeudados: [], proximos: [] })
    expect(repository.leerAdeudados).toHaveBeenCalledWith(
      expect.objectContaining(PERIODO_QUE_CRUZA_HOY),
    )
    expect(repository.leerProximos).toHaveBeenCalledWith(
      expect.objectContaining(PERIODO_QUE_CRUZA_HOY),
    )
  })

  it('período que empieza después del tope: los próximos aplican y quedan vacíos', async () => {
    const cuenta = await service.obtenerCuenta(12, PERIODO_DESPUES_DEL_TOPE)

    expect(cuenta).toEqual({ totalAdeudado: 0, adeudados: null, proximos: [], limiteCobro: TOPE })
  })

  it('materia y profesor llegan al repository en las dos secciones', async () => {
    await service.obtenerCuenta(12, { materiaId: 2, profesorId: 3 })

    const filtro = expect.objectContaining({ alumnoId: 12, materiaId: 2, profesorId: 3, hoy: HOY })
    expect(repository.leerAdeudados).toHaveBeenCalledWith(filtro)
    expect(repository.leerProximos).toHaveBeenCalledWith(filtro)
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

  it('sin filtro: lee todos con hoy del reloj, no busca alumno y aplica', async () => {
    const res = await service.listarAdeudados({ page: 1, pageSize: 20 })

    expect(repository.leerAdeudados).toHaveBeenCalledWith({
      alumnoId: undefined,
      materiaId: undefined,
      profesorId: undefined,
      desde: undefined,
      hasta: undefined,
      hoy: HOY,
    })
    expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
    expect(res.aplica).toBe(true)
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
      aplica: true,
    })
  })

  it('con alumnoId existente filtra por ese alumno', async () => {
    await service.listarAdeudados({ page: 1, pageSize: 20, alumnoId: 12 })

    expect(alumnosRepository.buscarPorId).toHaveBeenCalledWith(12)
    expect(repository.leerAdeudados).toHaveBeenCalledWith(
      expect.objectContaining({ alumnoId: 12, hoy: HOY }),
    )
  })

  it('período, materia y profesor llegan al repository; el total es el de ese filtro', async () => {
    repository.leerAdeudados.mockResolvedValue(cinco.slice(0, 2))

    const res = await service.listarAdeudados({
      page: 1,
      pageSize: 20,
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      ...PERIODO_QUE_CRUZA_HOY,
    })

    expect(repository.leerAdeudados).toHaveBeenCalledWith({
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      ...PERIODO_QUE_CRUZA_HOY,
      hoy: HOY,
    })
    expect(res.totalAdeudado).toBe(19000.5)
    expect(res.meta.total).toBe(2)
    expect(res.aplica).toBe(true)
  })

  it('período futuro: `aplica: false`, vacío y en 0, sin leer nada', async () => {
    expect(await service.listarAdeudados({ page: 1, pageSize: 20, ...PERIODO_FUTURO })).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      totalAdeudado: 0,
      aplica: false,
    })
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
  })

  it('período futuro con alumnoId inexistente: el 404 va antes que `aplica`', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)

    await expect(
      service.listarAdeudados({ page: 1, pageSize: 20, alumnoId: 99, ...PERIODO_FUTURO }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('listarProximos', () => {
  // Cinco próximos de dos alumnos, ya ordenados como los devuelve la condición.
  const cinco = [
    proximo({ fecha: HOY }),
    proximo({ turnoId: 57, fecha: '2026-10-06', alumnoId: 15, importe: 9000 }),
    proximo({ fecha: '2026-10-12' }),
    proximo({ turnoId: 57, fecha: '2026-10-13', alumnoId: 15, importe: null }),
    proximo({ fecha: '2026-10-19' }),
  ]

  beforeEach(() => {
    repository.leerProximos.mockResolvedValue(cinco)
  })

  it('de todos los alumnos: lee sin alumnoId, no busca alumno y trae el alumno con su DNI', async () => {
    const res = await service.listarProximos({ page: 1, pageSize: 20 })

    expect(repository.leerProximos).toHaveBeenCalledWith({
      alumnoId: undefined,
      materiaId: undefined,
      profesorId: undefined,
      desde: undefined,
      hasta: undefined,
      hoy: HOY,
    })
    expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
    expect(repository.leerAdeudados).not.toHaveBeenCalled()
    expect(res.data.map((p) => [p.turnoId, p.fecha, p.alumno.id])).toEqual([
      [41, HOY, 12],
      [57, '2026-10-06', 15],
      [41, '2026-10-12', 12],
      [57, '2026-10-13', 15],
      [41, '2026-10-19', 12],
    ])
    expect(res.data[1]).toEqual({
      turnoId: 57,
      fecha: '2026-10-06',
      horaInicio: '09:00',
      horaFin: '10:00',
      materia: { id: 2, nombre: 'Matemática' },
      profesor: { id: 3, nombre: 'Ana', apellido: 'Gómez' },
      estado: 'AGENDADO',
      importe: 9000,
      alumno: { id: 15, nombre: 'Alumno15', apellido: 'Paz', dni: '5015000' },
    })
    expect(JSON.stringify(res)).not.toContain('busqueda')
  })

  it('no tiene total: sólo data, meta, aplica y limiteCobro', async () => {
    const res = await service.listarProximos({ page: 1, pageSize: 20 })

    expect(Object.keys(res).sort()).toEqual(['aplica', 'data', 'limiteCobro', 'meta'])
    expect(res.aplica).toBe(true)
    expect(res.limiteCobro).toBe(TOPE)
  })

  it('de un alumno, con materia, profesor y período: todo llega al repository', async () => {
    await service.listarProximos({
      page: 1,
      pageSize: 20,
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      ...PERIODO_QUE_CRUZA_HOY,
    })

    expect(alumnosRepository.buscarPorId).toHaveBeenCalledWith(12)
    expect(repository.leerProximos).toHaveBeenCalledWith({
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      ...PERIODO_QUE_CRUZA_HOY,
      hoy: HOY,
    })
  })

  it('con alumnoId inexistente → 404 sin leer nada', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)

    await expect(
      service.listarProximos({ page: 1, pageSize: 20, alumnoId: 99 }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(repository.leerProximos).not.toHaveBeenCalled()
  })

  it('período pasado: `aplica: false` y vacío, sin leer nada; el tope viaja igual', async () => {
    expect(await service.listarProximos({ page: 1, pageSize: 20, ...PERIODO_PASADO })).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      aplica: false,
      limiteCobro: TOPE,
    })
    expect(repository.leerProximos).not.toHaveBeenCalled()
    expect(repository.dnisDeAlumnos).toHaveBeenCalledWith([])
  })

  it('período que empieza después del tope: aplica y queda vacío', async () => {
    repository.leerProximos.mockResolvedValue([])

    const res = await service.listarProximos({
      page: 1,
      pageSize: 20,
      ...PERIODO_DESPUES_DEL_TOPE,
    })

    expect(res).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      aplica: true,
      limiteCobro: TOPE,
    })
  })

  it('pagina en memoria: página 2 con su meta y el DNI sólo de los alumnos de la página', async () => {
    const res = await service.listarProximos({ page: 2, pageSize: 2 })

    expect(res.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 })
    expect(res.data.map((p) => [p.turnoId, p.fecha])).toEqual([
      [41, '2026-10-12'],
      [57, '2026-10-13'],
    ])
    expect(repository.dnisDeAlumnos).toHaveBeenCalledWith([12, 15])

    const ultima = await service.listarProximos({ page: 3, pageSize: 2 })
    expect(ultima.data.map((p) => p.fecha)).toEqual(['2026-10-19'])
    expect(repository.dnisDeAlumnos).toHaveBeenLastCalledWith([12])
  })

  it('página fuera de rango: vacía, con el meta correcto', async () => {
    const res = await service.listarProximos({ page: 9, pageSize: 2 })

    expect(res.data).toEqual([])
    expect(res.meta).toEqual({ page: 9, pageSize: 2, total: 5, totalPages: 3 })
  })
})
