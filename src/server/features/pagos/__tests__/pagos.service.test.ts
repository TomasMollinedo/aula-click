import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { Actor } from '@/server/shared/actor'
import { crearPagosService } from '../pagos.service'
import type { RegistrarPago } from '../pagos.validation'
import { crearPagosEnMemoria, type AdjuntoEnBase, type OcurrenciaEnBase } from './pagos-en-memoria'

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
let adjuntos: Map<number, AdjuntoEnBase>
let memoria: ReturnType<typeof crearPagosEnMemoria>
let alumnosRepository: { buscarPorId: ReturnType<typeof vi.fn<AlumnosRepository['buscarPorId']>> }
let service: ReturnType<typeof crearPagosService>

function armar() {
  memoria = crearPagosEnMemoria(base, precios, adjuntos)
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
  // Comprobantes subidos con `POST /adjuntos`: el 18 y el 19 por quien cobra, el 20 por otro.
  adjuntos = new Map([
    [18, { subidoPor: 'usr_mesa', pagoId: null }],
    [19, { subidoPor: 'usr_mesa', pagoId: null }],
    [20, { subidoPor: 'usr_otra_mesa', pagoId: null }],
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
    formaPago: 'EFECTIVO',
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
      formaPago: 'EFECTIVO',
      montoRecibido: 50000,
      vuelto: 42000,
    })
    expect(memoria.repository.registrar).toHaveBeenCalledWith(
      {
        alumnoId: 12,
        ocurrencias: [{ turnoId: 41, fecha: '2026-10-12' }],
        fechaPago: '2026-10-05',
        medio: { formaPago: 'EFECTIVO', montoRecibido: 50000 },
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

// HU-23 (T-96): transferencia y débito. Qué datos lleva cada medio lo valida el schema (tests de
// rutas); acá, lo que decide el cobro con cada uno y el comprobante adjunto.
describe('registrar: formas de pago', () => {
  const transferencia = (parcial: Partial<RegistrarPago> = {}) =>
    pago({
      formaPago: 'TRANSFERENCIA',
      montoRecibido: undefined,
      transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: 'Marta López' },
      comprobanteAdjuntoId: 18,
      ...parcial,
    })
  const debito = (parcial: Partial<RegistrarPago> = {}) =>
    pago({
      formaPago: 'DEBITO',
      montoRecibido: undefined,
      debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
      ...parcial,
    })

  it('transferencia: registra con sus datos, vincula el comprobante y no hay monto ni vuelto', async () => {
    const res = await service.registrar(transferencia(), actor)

    expect(res).toEqual({
      pagoId: 31,
      numeroComprobante: 1024,
      cantidad: 1,
      total: 8000,
      formaPago: 'TRANSFERENCIA',
      montoRecibido: null,
      vuelto: null,
    })
    expect(memoria.pagos[0]?.entrada.medio).toEqual({
      formaPago: 'TRANSFERENCIA',
      transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: 'Marta López' },
      comprobanteAdjuntoId: 18,
    })
    expect(adjuntos.get(18)?.pagoId).toBe(31)
  })

  it('transferencia: el importe no se compara con nada (no hay monto recibido)', async () => {
    const res = await service.registrar(
      transferencia({
        ocurrencias: [
          { turnoId: 41, fecha: '2026-10-12' },
          { turnoId: 57, fecha: '2026-10-07' },
        ],
      }),
      actor,
    )
    expect(res).toMatchObject({ total: 17000, montoRecibido: null, vuelto: null })
  })

  it('una transferencia puede cubrir a varios alumnos: la misma operación se repite sin error', async () => {
    await service.registrar(transferencia(), actor)
    const res = await service.registrar(
      transferencia({
        ocurrencias: [{ turnoId: 41, fecha: '2026-10-19' }],
        comprobanteAdjuntoId: 19,
      }),
      actor,
    )
    expect(res.pagoId).toBe(32)
  })

  it('débito sin adjunto: es opcional', async () => {
    const res = await service.registrar(debito(), actor)

    expect(res).toMatchObject({ formaPago: 'DEBITO', montoRecibido: null, vuelto: null })
    expect(memoria.pagos[0]?.entrada.medio).toEqual({
      formaPago: 'DEBITO',
      debito: { red: 'VISA_DEBITO', cupon: '000123', ultimos4: '1234' },
      comprobanteAdjuntoId: null,
    })
  })

  it('débito con adjunto: lo vincula', async () => {
    await service.registrar(debito({ comprobanteAdjuntoId: 19 }), actor)
    expect(adjuntos.get(19)?.pagoId).toBe(31)
  })

  it('el importe no cambia según el medio: el mismo turno vale lo mismo en los tres', async () => {
    const enEfectivo = await service.registrar(pago(), actor)
    armar()
    const porTransferencia = await service.registrar(transferencia(), actor)
    armar()
    const conDebito = await service.registrar(debito(), actor)

    expect([enEfectivo.total, porTransferencia.total, conDebito.total]).toEqual([8000, 8000, 8000])
  })

  it.each([
    ['subido por otro usuario', 20],
    ['que no existe', 77],
  ])('adjunto %s → 400 ADJUNTO_INVALIDO en comprobanteAdjuntoId, sin registrar', async (_, id) => {
    const error = await errorDe(
      service.registrar(transferencia({ comprobanteAdjuntoId: id }), actor),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(error.details).toEqual([{ path: ['comprobanteAdjuntoId'], message: expect.any(String) }])
    expect(memoria.pagos).toHaveLength(0)
  })

  it('un adjunto ya usado en otro pago → 400 ADJUNTO_INVALIDO', async () => {
    await service.registrar(transferencia(), actor)

    const error = await errorDe(
      service.registrar(
        transferencia({ ocurrencias: [{ turnoId: 41, fecha: '2026-10-19' }] }),
        actor,
      ),
    )

    expect(error.code).toBe('ADJUNTO_INVALIDO')
    expect(memoria.pagos).toHaveLength(1)
  })
})

// HU-22: la asistencia no cambia lo que se cobra, y un pago anulado libera sus ocurrencias.
describe('registrar: qué se puede cobrar con asistencia y anulaciones', () => {
  it.each(['REALIZADO', 'AUSENTE'] as const)('un %s impago se cobra', async (estado) => {
    base = [ocurrencia({ fecha: '2026-09-28', estado })]
    armar()

    const res = await service.registrar(
      pago({ ocurrencias: [{ turnoId: 41, fecha: '2026-09-28' }] }),
      actor,
    )

    expect(res).toMatchObject({ cantidad: 1, total: 8000 })
  })

  it('una ocurrencia de un pago anulado vuelve a estar pendiente y se cobra de nuevo', async () => {
    // El motor no cuenta los `PagoTurno` de un pago anulado (`vigente = null`): la devuelve
    // `PENDIENTE`, sin `pagoId`.
    base = [ocurrencia({ fecha: '2026-09-28', estado: 'REALIZADO', pago: { estado: 'PENDIENTE' } })]
    armar()

    const res = await service.registrar(
      pago({ ocurrencias: [{ turnoId: 41, fecha: '2026-09-28' }] }),
      actor,
    )

    expect(res.cantidad).toBe(1)
    expect(memoria.pagadas.get('41|2026-09-28')).toBe(res.pagoId)
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

describe('obtenerDetalle: el comprobante', () => {
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

    const comprobante = await service.obtenerDetalle(pagoId, actor)

    expect(comprobante).toMatchObject({
      id: pagoId,
      numeroComprobante: 1024,
      total: 17000,
      montoRecibido: 20000,
      vuelto: 3000,
      formaPago: { codigo: 'EFECTIVO', nombre: 'Efectivo' },
      transferencia: null,
      debito: null,
      estado: 'VIGENTE',
      anulacion: null,
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

    expect(await service.obtenerDetalle(pagoId, actor)).toMatchObject({
      montoRecibido: null,
      vuelto: null,
    })
  })

  it('un cambio de precio posterior no cambia el comprobante de un pago ya registrado', async () => {
    const { pagoId } = await service.registrar(pago(), actor)
    precios.set(2, 9999)

    const comprobante = await service.obtenerDetalle(pagoId, actor)
    expect(comprobante.total).toBe(8000)
    expect(comprobante.turnos[0]?.importe).toBe(8000)
  })

  it('de una transferencia: la forma por su código, sus datos y sin monto ni vuelto', async () => {
    await service.registrar(
      pago({
        formaPago: 'TRANSFERENCIA',
        montoRecibido: undefined,
        transferencia: { operacion: '0004829137', banco: 'Banco Macro' },
        comprobanteAdjuntoId: 18,
      }),
      actor,
    )

    expect(await service.obtenerDetalle(31, actor)).toMatchObject({
      formaPago: { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
      transferencia: { operacion: '0004829137', banco: 'Banco Macro', titular: null },
      debito: null,
      montoRecibido: null,
      vuelto: null,
      estado: 'VIGENTE',
      anulacion: null,
    })
  })

  it('inexistente → 404', async () => {
    expect(await errorDe(service.obtenerDetalle(99, actor))).toBeInstanceOf(NotFoundError)
  })
})

// T-98 (HU-36, HU-37): detalle con acciones, PDF por rol, pagos realizados y "Mis pagos".

const gerente: Actor = { userId: 'usr_gerente', role: 'GERENTE' }
const alumno: Actor = { userId: 'usr_alumno', role: 'ALUMNO', alumnoId: 12 }
const otroAlumno: Actor = { userId: 'usr_otro', role: 'ALUMNO', alumnoId: 99 }

const ADJUNTO = {
  id: 18,
  nombre: 'cupon.pdf',
  tipo: 'application/pdf',
  bytes: 1024,
  adjuntadoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
  adjuntadoEl: '2026-10-05T14:28:00.000Z',
}

/** Registra un pago con débito y el comprobante 18 adjunto. */
async function pagoConDebito() {
  const { pagoId } = await service.registrar(
    pago({
      formaPago: 'DEBITO',
      montoRecibido: undefined,
      debito: { red: 'VISA_DEBITO', cupon: '000123' },
      comprobanteAdjuntoId: 18,
    }),
    actor,
  )
  memoria.repository.buscarAdjunto.mockResolvedValue(ADJUNTO)
  return pagoId
}

describe('obtenerDetalle: cantidad, adjunto y acciones', () => {
  it('la mesa de entradas, en un débito vigente con adjunto: puede anular, reemplazar y quitar', async () => {
    const pagoId = await pagoConDebito()

    const detalle = await service.obtenerDetalle(pagoId, actor)

    expect(detalle).toMatchObject({
      id: pagoId,
      cantidad: 1,
      adjunto: ADJUNTO,
      acciones: { anular: true, reemplazarAdjunto: true, quitarAdjunto: true },
    })
    expect(memoria.repository.buscarAdjunto).toHaveBeenCalledExactlyOnceWith(pagoId)
  })

  it('el gerente ve el mismo pago en sólo lectura: todas las acciones en false', async () => {
    const pagoId = await pagoConDebito()

    const detalle = await service.obtenerDetalle(pagoId, gerente)

    expect(detalle.adjunto).toEqual(ADJUNTO)
    expect(detalle.acciones).toEqual({
      anular: false,
      reemplazarAdjunto: false,
      quitarAdjunto: false,
    })
  })

  it('un efectivo sin adjunto: `adjunto: null`, sólo anular', async () => {
    const { pagoId } = await service.registrar(pago(), actor)

    expect(await service.obtenerDetalle(pagoId, actor)).toMatchObject({
      adjunto: null,
      acciones: { anular: true, reemplazarAdjunto: false, quitarAdjunto: false },
    })
  })

  it('inexistente → 404 sin leer el adjunto', async () => {
    expect(await errorDe(service.obtenerDetalle(99, gerente))).toBeInstanceOf(NotFoundError)
    expect(memoria.repository.buscarAdjunto).not.toHaveBeenCalled()
  })
})

describe('comprobanteParaDocumento', () => {
  it('la mesa y el gerente: el comprobante con el vuelto, sin leer el adjunto', async () => {
    const { pagoId } = await service.registrar(pago(), actor)

    for (const quien of [actor, gerente]) {
      expect(await service.comprobanteParaDocumento(pagoId, quien)).toMatchObject({
        id: pagoId,
        vuelto: 42000,
      })
    }
    expect(memoria.repository.buscarAdjunto).not.toHaveBeenCalled()
  })

  it('el alumno, un pago suyo: el mismo documento', async () => {
    const { pagoId } = await service.registrar(pago(), actor)

    expect(await service.comprobanteParaDocumento(pagoId, alumno)).toMatchObject({
      id: pagoId,
      alumno: { id: 12 },
    })
  })

  it('el alumno, un pago de otro alumno → 403 SIN_PERMISO', async () => {
    const { pagoId } = await service.registrar(pago(), actor)

    const error = await errorDe(service.comprobanteParaDocumento(pagoId, otroAlumno))

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(error.code).toBe('SIN_PERMISO')
  })

  it('el alumno, un pago inexistente → 404 (antes que el 403 de propiedad)', async () => {
    expect(await errorDe(service.comprobanteParaDocumento(99, otroAlumno))).toBeInstanceOf(
      NotFoundError,
    )
  })

  it('una cuenta ALUMNO sin alumno → 403, sin buscar el pago', async () => {
    const sinAlumno: Actor = { userId: 'usr_x', role: 'ALUMNO' }

    expect(await errorDe(service.comprobanteParaDocumento(99, sinAlumno))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(memoria.repository.buscarComprobante).not.toHaveBeenCalled()
  })
})

describe('listar (pagos realizados)', () => {
  it('pasa el filtro y la paginación por separado; `cobrado` es la suma de las formas, en centavos', async () => {
    memoria.repository.listarRealizados.mockResolvedValue({
      data: [],
      meta: { page: 2, pageSize: 5, total: 7, totalPages: 2 },
      porForma: { EFECTIVO: 0.1, TRANSFERENCIA: 0.2, DEBITO: 10000 },
    })

    const res = await service.listar({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      alumnoId: 12,
      materiaId: 2,
      profesorId: 3,
      formaPago: 'EFECTIVO',
      page: 2,
      pageSize: 5,
    })

    expect(memoria.repository.listarRealizados).toHaveBeenCalledExactlyOnceWith(
      {
        desde: '2026-10-01',
        hasta: '2026-10-31',
        alumnoId: 12,
        materiaId: 2,
        profesorId: 3,
        formaPago: 'EFECTIVO',
      },
      { page: 2, pageSize: 5 },
    )
    expect(res).toEqual({
      data: [],
      meta: { page: 2, pageSize: 5, total: 7, totalPages: 2 },
      totales: {
        cobrado: 10000.3,
        porForma: { EFECTIVO: 0.1, TRANSFERENCIA: 0.2, DEBITO: 10000 },
      },
    })
  })
})

describe('misPagos', () => {
  const pagina = { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }

  it('lee los pagos del alumno de la sesión', async () => {
    memoria.repository.listarDelAlumno.mockResolvedValue(pagina)

    expect(await service.misPagos({ page: 1, pageSize: 10 }, alumno)).toEqual(pagina)
    expect(memoria.repository.listarDelAlumno).toHaveBeenCalledExactlyOnceWith(12, {
      page: 1,
      pageSize: 10,
    })
  })

  it.each([
    ['una cuenta ALUMNO sin alumno', { userId: 'usr_x', role: 'ALUMNO' } as Actor],
    ['la mesa de entradas', actor],
  ])('%s → 403, sin leer', async (_caso, quien) => {
    expect(await errorDe(service.misPagos({ page: 1, pageSize: 10 }, quien))).toBeInstanceOf(
      ForbiddenError,
    )
    expect(memoria.repository.listarDelAlumno).not.toHaveBeenCalled()
  })
})

describe('buscadores de los filtros (T-100)', () => {
  const LUCIA = { id: 12, nombre: 'Lucía', apellido: 'Álvarez' }

  it.each([
    ['sin q ni id: todos los que tienen pagos', {}, { terminos: [], id: undefined }],
    [
      'q: normalizado y partido en palabras, sin puntos ni tildes',
      { q: 'Álva. JUAN' },
      { terminos: ['alva', 'juan'], id: undefined },
    ],
    ['q con DNI con puntos', { q: '52.345' }, { terminos: ['52345'], id: undefined }],
    ['id solo', { id: 12 }, { terminos: [], id: 12 }],
    ['q e id juntos', { q: 'lucia', id: 12 }, { terminos: ['lucia'], id: 12 }],
  ])('alumnos, %s', async (_caso, query, esperado) => {
    memoria.repository.buscarAlumnos.mockResolvedValue([LUCIA])

    expect(await service.buscarAlumnos(query)).toEqual([LUCIA])
    expect(memoria.repository.buscarAlumnos).toHaveBeenCalledExactlyOnceWith(esperado)
  })

  it.each([
    ['q', { q: 'Gómez' }, { terminos: ['gomez'], id: undefined, alumnoId: undefined }],
    ['id', { id: 3 }, { terminos: [], id: 3, alumnoId: undefined }],
    ['q e id juntos', { q: 'ana', id: 3 }, { terminos: ['ana'], id: 3, alumnoId: undefined }],
    [
      'acotado al alumno (T-170)',
      { q: 'ana', alumnoId: 12 },
      { terminos: ['ana'], id: undefined, alumnoId: 12 },
    ],
  ])('profesores, %s', async (_caso, query, esperado) => {
    memoria.repository.buscarProfesores.mockResolvedValue([ANA])

    expect(await service.buscarProfesores(query)).toEqual([ANA])
    expect(memoria.repository.buscarProfesores).toHaveBeenCalledExactlyOnceWith(esperado)
  })

  it.each([
    ['sin q ni id', {}, { terminos: [], id: undefined, alumnoId: undefined }],
    [
      'q: normalizado y partido en palabras',
      { q: 'Matemática Fin' },
      { terminos: ['matematica', 'fin'], id: undefined, alumnoId: undefined },
    ],
    ['id', { id: 2 }, { terminos: [], id: 2, alumnoId: undefined }],
    [
      'acotado al alumno (T-170)',
      { q: 'mat', alumnoId: 12 },
      { terminos: ['mat'], id: undefined, alumnoId: 12 },
    ],
  ])('materias, %s', async (_caso, query, esperado) => {
    const MATEMATICA = { id: 2, nombre: 'Matemática' }
    memoria.repository.buscarMaterias.mockResolvedValue([MATEMATICA])

    expect(await service.buscarMaterias(query)).toEqual([MATEMATICA])
    expect(memoria.repository.buscarMaterias).toHaveBeenCalledExactlyOnceWith(esperado)
  })

  it('sin coincidencias, o un id sin pagos: [] (no es un error)', async () => {
    expect(await service.buscarAlumnos({ id: 999 })).toEqual([])
    expect(await service.buscarProfesores({ q: 'nadie' })).toEqual([])
    expect(await service.buscarMaterias({ alumnoId: 999 })).toEqual([])
  })
})
