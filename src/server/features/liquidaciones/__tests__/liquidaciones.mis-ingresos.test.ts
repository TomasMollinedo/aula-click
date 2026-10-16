import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenError, ValidationError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { EstadoLiquidacion, Liquidacion } from '../liquidaciones.condiciones'
import type { ClaseLeida } from '../liquidaciones.repository'
import { crearLiquidacionesService } from '../liquidaciones.service'

// "Mis ingresos" del profesor (HU-45, T-126) con el repository mockeado y el reloj fijo. El cálculo
// de la liquidación es del motor (T-121) y el estado de cada clase, del motor de ocurrencias: acá
// son datos. Lo que se prueba es qué se elige, en qué orden y qué no se publica.

const reloj = () => new Date('2026-10-15T15:00:00.000Z') // hoy: 2026-10-15 en Salta
const HOY = '2026-10-15'

const profesor: Actor = { userId: 'usr_profe', role: 'PROFESOR' }
const GOMEZ_ID = 4
const GOMEZ = { id: GOMEZ_ID, nombre: 'Ana', apellido: 'Gómez' }
const marta = { id: 'usr_gerente', nombre: 'Marta', apellido: 'Ríos' }

function liquidacion({
  mes = '2026-10',
  estado = 'EN_CURSO',
  cerrada = null,
  total = 6800,
}: {
  mes?: string
  estado?: EstadoLiquidacion
  cerrada?: Liquidacion['cerrada']
  total?: number
} = {}): Liquidacion {
  return {
    profesor: GOMEZ,
    mes,
    estado,
    turnos: [
      {
        pagoTurnoId: 1,
        turnoId: 2,
        fecha: `${mes}-08`,
        horaInicio: 960,
        horaFin: 1020,
        alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
        materia: { id: 2, nombre: 'Matemática' },
        numeroComprobante: 123,
        importe: 8000,
        porcentaje: 15,
        fechaDevengo: `${mes}-08`,
        parteCentro: 1200,
        parteProfesor: 6800,
      },
    ],
    ajustes: [],
    totalCobrado: 8000,
    parteCentro: 1200,
    parteProfesor: 6800,
    totalAjustes: total - 6800,
    total,
    cerrada,
  }
}

const cerradaPagada = {
  id: 31,
  fechaTransferencia: '2026-10-05',
  numeroOperacion: '0004829137',
  observaciones: 'Observación del gerente',
  descontadaEnMes: null,
  registradaPor: marta,
  registradaEl: '2026-10-05T14:03:00.000Z',
}

function clase(parcial: Partial<ClaseLeida> & { turnoId: number; fecha: string }): ClaseLeida {
  return {
    horaInicio: 960,
    horaFin: 1020,
    alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
    materia: { id: 2, nombre: 'Matemática' },
    estado: 'REALIZADO',
    pago: 'PENDIENTE',
    conAsistencia: true,
    plazoAsistencia: { vence: '2026-10-22', vencido: false },
    ...parcial,
  }
}

const repository = {
  delMes: vi.fn(),
  deProfesor: vi.fn(),
  leerProfesor: vi.fn(),
  ultimoAdjunto: vi.fn(),
  pagar: vi.fn(),
  profesorIdDeUsuario: vi.fn(),
  todasDelProfesor: vi.fn(),
  clasesDelProfesor: vi.fn(),
}
const service = crearLiquidacionesService({ repository, reloj })

beforeEach(() => {
  vi.resetAllMocks()
  repository.profesorIdDeUsuario.mockResolvedValue(GOMEZ_ID)
  repository.deProfesor.mockResolvedValue(null)
  repository.clasesDelProfesor.mockResolvedValue([])
  repository.todasDelProfesor.mockResolvedValue([])
})

describe('el profesor de la sesión', () => {
  it('sale del actor: el repository se consulta con su usuario y su profesor', async () => {
    await service.misIngresos(profesor)
    expect(repository.profesorIdDeUsuario).toHaveBeenCalledWith('usr_profe')
    expect(repository.deProfesor).toHaveBeenCalledWith({
      profesorId: GOMEZ_ID,
      mes: '2026-10',
      hoy: HOY,
    })
  })

  it.each([
    ['misIngresos', () => service.misIngresos(profesor)],
    ['misLiquidaciones', () => service.misLiquidaciones({ page: 1, pageSize: 20 }, profesor)],
    ['miLiquidacion', () => service.miLiquidacion({ mes: '2026-09' }, profesor)],
  ])('%s: un usuario sin ficha de profesor → 403', async (_nombre, llamar) => {
    repository.profesorIdDeUsuario.mockResolvedValue(null)
    await expect(llamar()).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('misIngresos: esteMes', () => {
  it('con datos: la liquidación del mes en curso, sin el número de comprobante', async () => {
    repository.deProfesor.mockResolvedValue(liquidacion())
    const { esteMes } = await service.misIngresos(profesor)
    expect(esteMes).toEqual({
      mes: '2026-10',
      estado: 'EN_CURSO',
      turnos: [
        {
          fecha: '2026-10-08',
          horaInicio: '16:00',
          horaFin: '17:00',
          alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
          materia: { id: 2, nombre: 'Matemática' },
          importe: 8000,
          porcentaje: 15,
          parteProfesor: 6800,
        },
      ],
      ajustes: [],
      cantidadTurnos: 1,
      totalCobrado: 8000,
      parteCentro: 1200,
      parteProfesor: 6800,
      totalAjustes: 0,
      total: 6800,
      cerrada: null,
    })
  })

  it('vacía: sin movimientos en el mes', async () => {
    const { esteMes } = await service.misIngresos(profesor)
    expect(esteMes).toMatchObject({
      mes: '2026-10',
      estado: null,
      turnos: [],
      ajustes: [],
      total: 0,
    })
  })

  it('coincide con el detalle del gerente para el mismo profesor y mes', async () => {
    const delMotor = liquidacion()
    repository.deProfesor.mockResolvedValue(delMotor)
    repository.leerProfesor.mockResolvedValue(GOMEZ)

    const { esteMes } = await service.misIngresos(profesor)
    const delGerente = await service.detalle({ profesorId: GOMEZ_ID, mes: '2026-10' })

    expect(esteMes.estado).toBe(delGerente.estado)
    expect(esteMes.ajustes).toEqual(delGerente.ajustes)
    // Los mismos turnos, sin el número de comprobante de las familias.
    expect(esteMes.turnos).toEqual(
      delGerente.turnos.map((turno) => {
        const sinComprobante: Partial<typeof turno> = { ...turno }
        delete sinComprobante.numeroComprobante
        return sinComprobante
      }),
    )
    for (const total of [
      'cantidadTurnos',
      'totalCobrado',
      'parteCentro',
      'parteProfesor',
      'totalAjustes',
      'total',
    ] as const) {
      expect(esteMes[total]).toBe(delGerente[total])
    }
  })
})

describe('misIngresos: las clases', () => {
  it('lee las ocurrencias de los últimos 366 días hasta hoy, con el reloj', async () => {
    await service.misIngresos(profesor)
    expect(repository.clasesDelProfesor).toHaveBeenCalledWith(
      { profesorId: GOMEZ_ID, desde: '2025-10-15', hasta: HOY },
      reloj,
    )
  })

  it('sin cobrar: con asistencia y sin pago vigente, de la más reciente a la más antigua', async () => {
    repository.clasesDelProfesor.mockResolvedValue([
      clase({ turnoId: 1, fecha: '2026-09-01', estado: 'REALIZADO' }),
      clase({ turnoId: 2, fecha: '2026-09-02', estado: 'AUSENTE' }),
      clase({ turnoId: 3, fecha: '2026-09-03', estado: 'REALIZADO', pago: 'PAGADO' }),
      clase({ turnoId: 4, fecha: '2026-09-04', estado: 'CANCELADO' }),
      clase({ turnoId: 5, fecha: '2026-09-05', estado: 'SIN_REGISTRAR', conAsistencia: false }),
    ])
    const { clasesSinCobrar } = await service.misIngresos(profesor)
    expect(clasesSinCobrar.map((c) => c.turnoId)).toEqual([2, 1])
    expect(clasesSinCobrar[0]).toEqual({
      turnoId: 2,
      fecha: '2026-09-02',
      horaInicio: '16:00',
      horaFin: '17:00',
      alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez' },
      materia: { id: 2, nombre: 'Matemática' },
    })
  })

  it('cobradas sin asistencia: con pago, sin asistencia y en plazo, con su vence', async () => {
    repository.clasesDelProfesor.mockResolvedValue([
      // Fuera del plazo (vencido).
      clase({
        turnoId: 1,
        fecha: '2026-10-01',
        estado: 'SIN_REGISTRAR',
        pago: 'PAGADO',
        conAsistencia: false,
        plazoAsistencia: { vence: '2026-10-08', vencido: true },
      }),
      clase({
        turnoId: 2,
        fecha: '2026-10-10',
        estado: 'SIN_REGISTRAR',
        pago: 'PAGADO',
        conAsistencia: false,
        plazoAsistencia: { vence: '2026-10-17', vencido: false },
      }),
      // Con asistencia: no.
      clase({ turnoId: 3, fecha: '2026-10-12', pago: 'PAGADO' }),
      // Sin pago: no.
      clase({
        turnoId: 4,
        fecha: '2026-10-13',
        estado: 'SIN_REGISTRAR',
        conAsistencia: false,
        plazoAsistencia: { vence: '2026-10-20', vencido: false },
      }),
      // Cancelada: no.
      clase({
        turnoId: 5,
        fecha: '2026-10-14',
        estado: 'CANCELADO',
        pago: 'PAGADO',
        conAsistencia: false,
        plazoAsistencia: null,
      }),
      // De hoy, todavía agendada: sí.
      clase({
        turnoId: 6,
        fecha: HOY,
        estado: 'AGENDADO',
        pago: 'PAGADO',
        conAsistencia: false,
        plazoAsistencia: { vence: '2026-10-22', vencido: false },
      }),
    ])
    const { clasesCobradasSinAsistencia } = await service.misIngresos(profesor)
    expect(clasesCobradasSinAsistencia.map((c) => [c.turnoId, c.vence])).toEqual([
      [6, '2026-10-22'],
      [2, '2026-10-17'],
    ])
  })

  it('vacías: sin clases', async () => {
    const respuesta = await service.misIngresos(profesor)
    expect(respuesta.clasesSinCobrar).toEqual([])
    expect(respuesta.clasesCobradasSinAsistencia).toEqual([])
  })
})

describe('misLiquidaciones', () => {
  it('una fila por mes, sin el mes en curso, del más reciente al más antiguo', async () => {
    repository.todasDelProfesor.mockResolvedValue([
      liquidacion({
        mes: '2026-08',
        estado: 'PAGADA',
        cerrada: { ...cerradaPagada, fechaTransferencia: '2026-09-04' },
      }),
      liquidacion({ mes: '2026-09', estado: 'PENDIENTE_DE_PAGO', total: 5000 }),
      liquidacion({ mes: '2026-10', estado: 'EN_CURSO' }),
    ])
    const respuesta = await service.misLiquidaciones({ page: 1, pageSize: 20 }, profesor)
    expect(repository.todasDelProfesor).toHaveBeenCalledWith({ profesorId: GOMEZ_ID, hoy: HOY })
    expect(respuesta).toEqual({
      data: [
        { mes: '2026-09', estado: 'PENDIENTE_DE_PAGO', total: 5000, fechaTransferencia: null },
        { mes: '2026-08', estado: 'PAGADA', total: 6800, fechaTransferencia: '2026-09-04' },
      ],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    })
  })

  it('pagina en memoria', async () => {
    repository.todasDelProfesor.mockResolvedValue(
      ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((mes) =>
        liquidacion({ mes, estado: 'PENDIENTE_DE_PAGO' }),
      ),
    )
    const respuesta = await service.misLiquidaciones({ page: 2, pageSize: 2 }, profesor)
    expect(respuesta.data.map((f) => f.mes)).toEqual(['2026-07', '2026-06'])
    expect(respuesta.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 })
  })

  it('vacía: sin liquidaciones', async () => {
    const respuesta = await service.misLiquidaciones({ page: 1, pageSize: 20 }, profesor)
    expect(respuesta).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })
  })
})

describe('miLiquidacion', () => {
  it('una cerrada: sin observaciones, adjunto ni quién registró el pago', async () => {
    repository.deProfesor.mockResolvedValue(
      liquidacion({ mes: '2026-09', estado: 'PAGADA', cerrada: cerradaPagada }),
    )
    const mia = await service.miLiquidacion({ mes: '2026-09' }, profesor)
    expect(repository.deProfesor).toHaveBeenCalledWith({
      profesorId: GOMEZ_ID,
      mes: '2026-09',
      hoy: HOY,
    })
    expect(mia.cerrada).toEqual({
      liquidacionId: 31,
      fechaTransferencia: '2026-10-05',
      numeroOperacion: '0004829137',
      descontadaEnMes: null,
    })
  })

  it('el mes en curso también se puede pedir', async () => {
    repository.deProfesor.mockResolvedValue(liquidacion())
    const mia = await service.miLiquidacion({ mes: '2026-10' }, profesor)
    expect(mia.estado).toBe('EN_CURSO')
  })

  it('sin movimientos: la liquidación vacía', async () => {
    const mia = await service.miLiquidacion({ mes: '2026-07' }, profesor)
    expect(mia).toMatchObject({ mes: '2026-07', estado: null, turnos: [], cerrada: null })
  })

  it('un mes futuro → 400 en mes', async () => {
    await expect(service.miLiquidacion({ mes: '2026-11' }, profesor)).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(repository.deProfesor).not.toHaveBeenCalled()
  })
})

describe('nada de otros profesores ni del centro', () => {
  it('las respuestas no traen el profesor, el comprobante de las familias ni datos del gerente', async () => {
    repository.deProfesor.mockResolvedValue(
      liquidacion({ mes: '2026-09', estado: 'PAGADA', cerrada: cerradaPagada }),
    )
    repository.clasesDelProfesor.mockResolvedValue([clase({ turnoId: 1, fecha: '2026-10-01' })])
    repository.todasDelProfesor.mockResolvedValue([
      liquidacion({ mes: '2026-09', estado: 'PAGADA', cerrada: cerradaPagada }),
    ])

    const texto = JSON.stringify([
      await service.misIngresos(profesor),
      await service.misLiquidaciones({ page: 1, pageSize: 20 }, profesor),
      await service.miLiquidacion({ mes: '2026-09' }, profesor),
    ])
    for (const clave of [
      'numeroComprobante',
      'observaciones',
      'comprobanteAdjunto',
      'registradaPor',
      'registradaEl',
      'acciones',
      'profesor',
      'Gómez',
      'Marta',
    ]) {
      expect(texto).not.toContain(clave)
    }
  })
})
