import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { Actor } from '@/server/shared/actor'
import { crearPagosService } from '../pagos.service'
import type { RegistrarPago } from '../pagos.validation'
import { crearPagosEnMemoria, type OcurrenciaEnBase } from './pagos-en-memoria'

// Service de pagos (T-51) contra el repository en memoria (`pagos-en-memoria.ts`), que ejecuta el
// `verificar` real bajo una cola como el lock del alumno. Reloj fijo: lunes 05/10/2026 al
// mediodía en Salta; hoy + 56 = lunes 30/11/2026.

const reloj = () => new Date('2026-10-05T15:00:00Z')
const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

const ANA = { id: 3, nombre: 'Ana', apellido: 'Gómez' }
const JUAN = { id: 5, nombre: 'Juan', apellido: 'Ruiz' }

function ocurrencia(parcial: Partial<OcurrenciaEnBase> = {}): OcurrenciaEnBase {
  return {
    turnoId: 41,
    fecha: '2026-10-12',
    alumnoId: 12,
    materiaId: 2,
    estado: 'AGENDADO',
    pago: { estado: 'PENDIENTE' },
    horaInicio: 540,
    profesor: ANA,
    ...parcial,
  }
}

let base: OcurrenciaEnBase[]
let precios: Map<number, number | null>
let memoria: ReturnType<typeof crearPagosEnMemoria>
let alumnosRepository: { buscarPorId: ReturnType<typeof vi.fn<AlumnosRepository['buscarPorId']>> }
let service: ReturnType<typeof crearPagosService>

function armar() {
  memoria = crearPagosEnMemoria(base, precios)
  service = crearPagosService({ repository: memoria.repository, alumnosRepository, reloj })
}

beforeEach(() => {
  base = [
    ocurrencia(), // Ana, lunes 12/10 9:00, Matemática
    ocurrencia({ fecha: '2026-10-19' }),
    ocurrencia({
      turnoId: 57,
      fecha: '2026-10-07',
      materiaId: 7,
      horaInicio: 1020,
      profesor: JUAN,
    }),
  ]
  precios = new Map<number, number | null>([
    [2, 8000],
    [7, 9000],
  ])
  alumnosRepository = {
    buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>().mockResolvedValue({
      id: 12,
    } as Awaited<ReturnType<AlumnosRepository['buscarPorId']>>),
  }
  armar()
})

function pago(parcial: Partial<RegistrarPago> = {}): RegistrarPago {
  return {
    alumnoId: 12,
    ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
    fechaPago: '2026-10-05',
    montoRecibido: 50000,
    ...parcial,
  }
}

async function errorDe(promesa: Promise<unknown>): Promise<AppError> {
  try {
    await promesa
  } catch (error) {
    return error as AppError
  }
  throw new Error('No lanzó')
}

describe('registrar: camino feliz', () => {
  it('un turno: registra y responde cantidad, total, montoRecibido y vuelto', async () => {
    const res = await service.registrar(pago(), actor)

    expect(res).toEqual({
      pagoId: 31,
      numeroComprobante: 1024,
      cantidad: 1,
      total: 8000,
      montoRecibido: 50000,
      vuelto: 42000,
    })
    expect(memoria.repository.registrar).toHaveBeenCalledWith(
      {
        alumnoId: 12,
        ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
        fechaPago: '2026-10-05',
        montoRecibido: 50000,
        observaciones: null,
      },
      expect.any(Function),
      actor,
      reloj,
    )
  })

  it('varios turnos de dos profesores distintos, con montoRecibido: responde el vuelto', async () => {
    const res = await service.registrar(
      pago({
        ocurrencias: [
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 41, fecha: '2026-10-19' },
          { turnoId: 57, fecha: '2026-10-07' },
        ],
        montoRecibido: 30000,
        observaciones: 'Octubre',
      }),
      actor,
    )

    expect(res).toMatchObject({ cantidad: 3, total: 25000, montoRecibido: 30000, vuelto: 5000 })
    expect(memoria.pagos[0]?.plan.lineas).toEqual([
      { turnoId: 41, fecha: '2026-10-12', importe: 8000 },
      { turnoId: 41, fecha: '2026-10-19', importe: 8000 },
      { turnoId: 57, fecha: '2026-10-07', importe: 9000 },
    ])
  })

  it('después de registrar, las ocurrencias quedan PAGADO con el mismo pagoId', async () => {
    const { pagoId } = await service.registrar(
      pago({
        ocurrencias: [
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 57, fecha: '2026-10-07' },
        ],
      }),
      actor,
    )

    const snapshot = await memoria.repository.leerSnapshot([
      { turnoId: 41, fecha: '2026-10-12' },
      { turnoId: 57, fecha: '2026-10-07' },
    ])
    expect(snapshot.ocurrencias.filter((o) => o.pago.estado === 'PAGADO')).toEqual([
      expect.objectContaining({ turnoId: 41, pago: { estado: 'PAGADO', pagoId } }),
      expect.objectContaining({ turnoId: 57, pago: { estado: 'PAGADO', pagoId } }),
    ])
  })

  it('montoRecibido igual al total → vuelto 0', async () => {
    expect((await service.registrar(pago({ montoRecibido: 8000 }), actor)).vuelto).toBe(0)
  })

  it('una SIN_REGISTRAR (pasada) se cobra', async () => {
    base.push(ocurrencia({ fecha: '2026-09-28', estado: 'SIN_REGISTRAR' }))
    armar()
    const res = await service.registrar(
      pago({ ocurrencias: [{ turnoId: 41, fecha: '2026-09-28' }] }),
      actor,
    )
    expect(res.cantidad).toBe(1)
  })

  it('el importe sale del precio vigente: 3 × 10.000,50 = 30.001,50 exacto', async () => {
    precios.set(2, 10000.5)
    base.push(ocurrencia({ fecha: '2026-10-26' }))
    armar()

    const res = await service.registrar(
      pago({
        ocurrencias: [
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 41, fecha: '2026-10-19' },
          { turnoId: 41, fecha: '2026-10-26' },
        ],
        montoRecibido: 30001.6,
      }),
      actor,
    )

    expect(res.total).toBe(30001.5)
    expect(res.vuelto).toBe(0.1)
  })

  it('el borde de las 8 semanas (hoy + 56) se cobra', async () => {
    base.push(ocurrencia({ fecha: '2026-11-30' }))
    armar()
    const res = await service.registrar(
      pago({ ocurrencias: [{ turnoId: 41, fecha: '2026-11-30' }] }),
      actor,
    )
    expect(res.cantidad).toBe(1)
  })

  it('si el precio cambia entre el chequeo previo y el lock, cobra el vigente al registrar', async () => {
    memoria.repository.leerSnapshot.mockImplementationOnce(async (pedidas) => {
      const snapshot = {
        ocurrencias: base.filter((o) =>
          pedidas.some((p) => p.turnoId === o.turnoId && p.fecha === o.fecha),
        ),
        precios: new Map(precios),
      }
      precios.set(2, 8500) // el gerente cambia el precio mientras tanto
      return snapshot
    })

    expect((await service.registrar(pago(), actor)).total).toBe(8500)
  })
})

describe('registrar: errores', () => {
  it('fechaPago posterior a hoy → 400 en fechaPago, sin leer nada', async () => {
    const error = await errorDe(service.registrar(pago({ fechaPago: '2026-10-06' }), actor))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      { path: ['fechaPago'], message: 'La fecha de pago no puede ser posterior a hoy' },
    ])
    expect(alumnosRepository.buscarPorId).not.toHaveBeenCalled()
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
  })

  it('alumno inexistente → 404', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    const error = await errorDe(service.registrar(pago(), actor))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
  })

  it('turno de otro alumno → 400 en ocurrencias', async () => {
    base.push(ocurrencia({ turnoId: 70, alumnoId: 13 }))
    armar()
    const error = await errorDe(
      service.registrar(
        pago({
          ocurrencias: [
            { turnoId: 41, fecha: '2026-10-12' },
            { turnoId: 70, fecha: '2026-10-12' },
          ],
        }),
        actor,
      ),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      {
        path: ['ocurrencias', 1],
        message: 'El turno no es del alumno',
        turnoId: 70,
        fecha: '2026-10-12',
      },
    ])
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
  })

  it('cancelado → 409 CANCELADO sin llamar a registrar', async () => {
    base[0] = ocurrencia({ estado: 'CANCELADO' })
    armar()
    const error = await errorDe(service.registrar(pago(), actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('TURNOS_NO_COBRABLES')
    expect(error.details).toEqual([
      expect.objectContaining({ motivo: 'CANCELADO', path: ['ocurrencias', 0] }),
    ])
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
  })

  it('ya pagado → 409 YA_PAGADO con pagoId, sin llamar a registrar', async () => {
    base[0] = ocurrencia({ pago: { estado: 'PAGADO', pagoId: 29 } })
    armar()
    const error = await errorDe(service.registrar(pago(), actor))

    expect(error.code).toBe('TURNOS_NO_COBRABLES')
    expect(error.details).toEqual([
      {
        path: ['ocurrencias', 0],
        message: 'El turno ya está pagado',
        turnoId: 41,
        fecha: '2026-10-12',
        motivo: 'YA_PAGADO',
        pagoId: 29,
      },
    ])
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
  })

  it('uno cobrable y uno no → 409 sólo con el que falla, y no se registra nada', async () => {
    base[1] = ocurrencia({ fecha: '2026-10-19', estado: 'CANCELADO' })
    armar()
    const error = await errorDe(
      service.registrar(
        pago({
          ocurrencias: [
            { turnoId: 41, fecha: '2026-10-12' },
            { turnoId: 41, fecha: '2026-10-19' },
          ],
        }),
        actor,
      ),
    )

    expect(error.details).toEqual([
      expect.objectContaining({ path: ['ocurrencias', 1], turnoId: 41, fecha: '2026-10-19' }),
    ])
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
    expect(memoria.pagos).toHaveLength(0)
  })

  it('NO_EXISTE: una fecha posterior al fin efectivo de la serie (el motor no la devuelve)', async () => {
    // La serie del turno 41 terminó (finalizada) el 19/10: el 26/10 no es una ocurrencia suya.
    const error = await errorDe(
      service.registrar(pago({ ocurrencias: [{ turnoId: 41, fecha: '2026-10-26' }] }), actor),
    )
    expect(error.details).toEqual([
      expect.objectContaining({ motivo: 'NO_EXISTE', message: 'El turno no existe en esa fecha' }),
    ])
  })

  it('FUERA_DE_RANGO: hoy + 57', async () => {
    base.push(ocurrencia({ fecha: '2026-12-01' }))
    armar()
    const error = await errorDe(
      service.registrar(pago({ ocurrencias: [{ turnoId: 41, fecha: '2026-12-01' }] }), actor),
    )
    expect(error.details).toEqual([expect.objectContaining({ motivo: 'FUERA_DE_RANGO' })])
  })

  it('SIN_PRECIO: la materia no tiene precio cargado', async () => {
    precios.set(2, null)
    armar()
    const error = await errorDe(service.registrar(pago(), actor))
    expect(error.details).toEqual([expect.objectContaining({ motivo: 'SIN_PRECIO' })])
  })

  it('montoRecibido menor al total → 400 en montoRecibido con el texto exacto', async () => {
    base.push(ocurrencia({ fecha: '2026-10-26' }), ocurrencia({ fecha: '2026-11-02' }))
    armar()
    const error = await errorDe(
      service.registrar(
        pago({
          ocurrencias: ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'].map((fecha) => ({
            turnoId: 41,
            fecha,
          })),
          montoRecibido: 30000,
        }),
        actor,
      ),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      {
        path: ['montoRecibido'],
        message: 'El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)',
      },
    ])
    expect(memoria.repository.registrar).not.toHaveBeenCalled()
  })
})

describe('registrar: concurrencia', () => {
  // La garantía real es el `FOR UPDATE` del alumno (`bloquearAlumno`) dentro de
  // `pagosRepository.registrar`, con el único de `pago_turno` como última red. Acá el fake la
  // imita con una cola y ejecuta el `verificar` real: el segundo decide con el primero ya escrito.
  it('dos pagos simultáneos de la misma ocurrencia → sólo uno; el otro recibe 409 YA_PAGADO', async () => {
    const resultados = await Promise.allSettled([
      service.registrar(pago(), actor),
      service.registrar(pago({ montoRecibido: 10000 }), actor),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rechazos = resultados.filter((r) => r.status === 'rejected')
    expect(rechazos).toHaveLength(1)
    const razon = (rechazos[0] as PromiseRejectedResult).reason as AppError
    expect(razon.code).toBe('TURNOS_NO_COBRABLES')
    expect(razon.details).toEqual([expect.objectContaining({ motivo: 'YA_PAGADO', pagoId: 31 })])
    expect(memoria.pagos).toHaveLength(1)
  })
})

describe('obtenerComprobante', () => {
  it('devuelve el comprobante con el vuelto recalculado', async () => {
    const { pagoId } = await service.registrar(
      pago({
        ocurrencias: [
          { turnoId: 57, fecha: '2026-10-07' },
          { turnoId: 41, fecha: '2026-10-12' },
        ],
        montoRecibido: 20000,
      }),
      actor,
    )

    const comprobante = await service.obtenerComprobante(pagoId)

    expect(comprobante).toMatchObject({
      id: pagoId,
      numeroComprobante: 1024,
      total: 17000,
      montoRecibido: 20000,
      vuelto: 3000,
      formaPago: { id: 1, nombre: 'Efectivo' },
    })
    expect(comprobante.turnos.map((t) => [t.turnoId, t.profesor.id, t.importe])).toEqual([
      [57, 5, 9000],
      [41, 3, 8000],
    ])
  })

  it('un pago anterior a que el monto fuera obligatorio (sin montoRecibido): vuelto null', async () => {
    const { pagoId } = await service.registrar(pago(), actor)
    const guardado = await memoria.repository.buscarComprobante(pagoId)
    memoria.repository.buscarComprobante.mockResolvedValueOnce(
      guardado && { ...guardado, montoRecibido: null },
    )

    expect(await service.obtenerComprobante(pagoId)).toMatchObject({
      montoRecibido: null,
      vuelto: null,
    })
  })

  it('un cambio de precio posterior no cambia el comprobante de un pago ya registrado', async () => {
    const { pagoId } = await service.registrar(pago(), actor)
    precios.set(2, 9999)

    const comprobante = await service.obtenerComprobante(pagoId)
    expect(comprobante.total).toBe(8000)
    expect(comprobante.turnos[0]?.importe).toBe(8000)
  })

  it('inexistente → 404', async () => {
    expect(await errorDe(service.obtenerComprobante(99))).toBeInstanceOf(NotFoundError)
  })
})
