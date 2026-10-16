import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { crearAnulacionesService } from '../anulaciones.service'
import { anularPagoSchema, type AnularPago } from '../anulaciones.validation'
import { crearAnulacionesEnMemoria, type PagoEnBase } from './anulaciones-en-memoria'

// Service de anulaciones (T-104) contra el repository en memoria (`anulaciones-en-memoria.ts`), que
// ejecuta el `verificar` real bajo una cola como el lock del alumno. Reloj fijo: jueves 15/10/2026
// al mediodía en Salta (deuda vencida: fecha <= 15/09).

const reloj = () => new Date('2026-10-15T15:00:00Z')
const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const juan = { id: 12, nombre: 'Juan', apellido: 'Pérez' }
const lucia = { id: 14, nombre: 'Lucía', apellido: 'Álvarez' }
const matematica = { id: 2, nombre: 'Matemática' }
const lengua = { id: 3, nombre: 'Lengua' }
const fisica = { id: 4, nombre: 'Física' }

function pago(parcial: Partial<PagoEnBase> = {}): PagoEnBase {
  return {
    id: 31,
    numeroComprobante: 123,
    estado: 'VIGENTE',
    alumno: juan,
    total: 32000,
    turnos: [
      { turnoId: 41, fecha: '2026-10-05', materia: matematica, importe: 8000 },
      { turnoId: 41, fecha: '2026-10-12', materia: matematica, importe: 8000 },
      { turnoId: 41, fecha: '2026-10-19', materia: matematica, importe: 8000 },
      { turnoId: 41, fecha: '2026-10-26', materia: matematica, importe: 8000 },
    ],
    transferencia: null,
    ...parcial,
  }
}

function pedido(parcial: Partial<AnularPago> = {}): AnularPago {
  return { pagoId: 31, motivo: 'ERROR_CARGA', ...parcial }
}

async function errorDe(promesa: Promise<unknown>): Promise<AppError> {
  try {
    await promesa
  } catch (error) {
    return error as AppError
  }
  throw new Error('Debía fallar')
}

let base: PagoEnBase[]
let memoria: ReturnType<typeof crearAnulacionesEnMemoria>
let service: ReturnType<typeof crearAnulacionesService>

function armar(datos?: Parameters<typeof crearAnulacionesEnMemoria>[1]) {
  memoria = crearAnulacionesEnMemoria(base, datos)
  service = crearAnulacionesService({ repository: memoria.repository, reloj })
}

beforeEach(() => {
  base = [pago()]
  armar({ precios: new Map([[2, 8000]]) })
})

describe('validación del body', () => {
  it('OTRO sin detalle → 400 en detalle (también "" y espacios)', () => {
    for (const detalle of [undefined, '', '   ', null]) {
      const res = anularPagoSchema.safeParse({ pagoId: 31, motivo: 'OTRO', detalle })
      expect(res.success).toBe(false)
      expect(res.error?.issues[0]?.path).toEqual(['detalle'])
    }
  })

  it('OTRO con detalle y los otros motivos sin detalle son válidos', () => {
    const validos = [
      { pagoId: 31, motivo: 'OTRO', detalle: 'x' },
      { pagoId: 31, motivo: 'ERROR_CARGA' },
      { pagoId: 31, motivo: 'FORMA_PAGO_EQUIVOCADA' },
    ]
    for (const dato of validos) expect(anularPagoSchema.safeParse(dato).success).toBe(true)
  })

  it('detalle de más de 500 caracteres, motivo fuera del enum o pagoId inválido → 400', () => {
    const malos = [
      { pagoId: 31, motivo: 'ERROR_CARGA', detalle: 'x'.repeat(501) },
      { pagoId: 31, motivo: 'PORQUE_SI' },
      { pagoId: 0, motivo: 'ERROR_CARGA' },
      { motivo: 'ERROR_CARGA' },
    ]
    for (const dato of malos) expect(anularPagoSchema.safeParse(dato).success).toBe(false)
  })

  it('el detalle se recorta y "" queda null', () => {
    const recortado = anularPagoSchema.parse({
      pagoId: 31,
      motivo: 'ERROR_CARGA',
      detalle: ' hola ',
    })
    const vacio = anularPagoSchema.parse({ pagoId: 31, motivo: 'ERROR_CARGA', detalle: '  ' })

    expect(recortado.detalle).toBe('hola')
    expect(vacio.detalle).toBeNull()
  })
})

describe('anular', () => {
  it('anula el pago completo: responde { pagoId, cantidad } y registra la anulación', async () => {
    const res = await service.anular(
      pedido({ motivo: 'OTRO', detalle: 'Alumno equivocado' }),
      actor,
    )

    expect(res).toEqual({ pagoId: 31, cantidad: 4 })
    expect(base[0]?.estado).toBe('ANULADO')
    expect(memoria.anulaciones.get(31)).toEqual({
      motivo: 'OTRO',
      detalle: 'Alumno equivocado',
      creadoPor: 'usr_mesa',
    })
  })

  it('pasa el alumno del pago al repository y el detalle ausente como null', async () => {
    await service.anular(pedido(), actor)

    expect(memoria.repository.anular.mock.calls[0]?.[0]).toEqual({
      pagoId: 31,
      alumnoId: 12,
      motivo: 'ERROR_CARGA',
      detalle: null,
    })
  })

  it('los turnos quedan pendientes y se pueden volver a cobrar', async () => {
    expect(memoria.pagadas().size).toBe(4)

    await service.anular(pedido(), actor)
    expect(memoria.pagadas().size).toBe(0)

    await memoria.cobrar(pago({ id: 40, numeroComprobante: 130 }))
    expect([...memoria.pagadas().values()]).toEqual([40, 40, 40, 40])
    // El pago anulado conserva sus datos y su número no se reutiliza.
    expect(base[0]).toMatchObject({ id: 31, numeroComprobante: 123, total: 32000 })
  })

  it('pago inexistente → 404 y no se escribe nada', async () => {
    const error = await errorDe(service.anular(pedido({ pagoId: 999 }), actor))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('Pago no encontrado')
    expect(memoria.repository.anular).not.toHaveBeenCalled()
  })

  it('doble anulación → 409 PAGO_ANULADO y la primera queda como estaba', async () => {
    await service.anular(pedido({ detalle: 'primera' }), actor)

    const error = await errorDe(service.anular(pedido({ motivo: 'FORMA_PAGO_EQUIVOCADA' }), actor))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.statusCode).toBe(409)
    expect(error.code).toBe('PAGO_ANULADO')
    expect(error.message).toBe('Un pago anulado no se puede volver a activar')
    expect(memoria.anulaciones.get(31)?.detalle).toBe('primera')
  })

  it('dos anulaciones simultáneas: una gana y la otra recibe 409 (el lock las serializa)', async () => {
    const resultados = await Promise.allSettled([
      service.anular(pedido(), actor),
      service.anular(pedido(), actor),
    ])

    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
    const rechazo = resultados[1] as PromiseRejectedResult
    expect((rechazo.reason as AppError).code).toBe('PAGO_ANULADO')
    expect(memoria.anulaciones.size).toBe(1)
  })

  it('carrera con un pago nuevo de las mismas ocurrencias: si anula primero, el cobro entra', async () => {
    const anulando = service.anular(pedido(), actor)
    // La anulación ya está en la cola del lock cuando llega el cobro.
    await vi.waitFor(() => expect(memoria.repository.anular).toHaveBeenCalled())
    const cobrando = memoria.cobrar(pago({ id: 40, numeroComprobante: 130 }))

    await expect(anulando).resolves.toEqual({ pagoId: 31, cantidad: 4 })
    await expect(cobrando).resolves.toBeUndefined()
    // Un solo pago vigente por ocurrencia: el nuevo.
    expect(new Set(memoria.pagadas().values())).toEqual(new Set([40]))
  })

  it('carrera con un pago nuevo de las mismas ocurrencias: si cobra primero, falla y no hay doble pago', async () => {
    const [cobro, anulado] = await Promise.allSettled([
      memoria.cobrar(pago({ id: 40, numeroComprobante: 130 })),
      service.anular(pedido(), actor),
    ])

    // El cobro llegó cuando el pago 31 seguía vigente: la base lo rechaza (único de `pago_turno`).
    expect(cobro.status).toBe('rejected')
    expect(anulado.status).toBe('fulfilled')
    expect(memoria.pagadas().size).toBe(0)
    expect(base.map((p) => p.id)).toEqual([31])
  })
})

// T-179: un pago con algún turno ya dictado (con asistencia) no se anula. El pago de siempre tiene
// dos turnos pasados (05/10 y 12/10) y dos futuros (19/10 y 26/10).
describe('turnos ya dictados', () => {
  const MENSAJE = 'No se puede anular: el pago incluye turnos que ya se dictaron'

  function sinEscrituras() {
    expect(base[0]?.estado).toBe('VIGENTE')
    expect(memoria.anulaciones.size).toBe(0)
    expect(memoria.pagadas().size).toBe(4)
  }

  it.each(['PRESENTE', 'AUSENTE'] as const)(
    'un turno %s → 409 TURNOS_DICTADOS en la previa y al anular, con el turno en details',
    async (asistencia) => {
      armar({ precios: new Map([[2, 8000]]), asistencias: [[41, '2026-10-05', asistencia]] })

      for (const promesa of [service.previa(31), service.anular(pedido(), actor)]) {
        const error = await errorDe(promesa)
        expect(error).toBeInstanceOf(ConflictError)
        expect(error.statusCode).toBe(409)
        expect(error.code).toBe('TURNOS_DICTADOS')
        expect(error.message).toBe(MENSAJE)
        expect(error.details).toEqual([{ fecha: '2026-10-05', materia: matematica, asistencia }])
      }
      // El chequeo previo ya lo frena: ni siquiera llega al lock.
      expect(memoria.repository.anular).not.toHaveBeenCalled()
      sinEscrituras()
    },
  )

  it('pago mixto (uno dictado y otros futuros) → 409 con sólo los dictados y no se escribe nada', async () => {
    armar({
      precios: new Map([[2, 8000]]),
      asistencias: [
        [41, '2026-10-05', 'PRESENTE'],
        [41, '2026-10-12', 'AUSENTE'],
      ],
    })

    const error = await errorDe(service.anular(pedido(), actor))

    expect(error.code).toBe('TURNOS_DICTADOS')
    expect(error.details).toEqual([
      { fecha: '2026-10-05', materia: matematica, asistencia: 'PRESENTE' },
      { fecha: '2026-10-12', materia: matematica, asistencia: 'AUSENTE' },
    ])
    sinEscrituras()
  })

  it('sin asistencias (pasados sin registrar y futuros) → se anula como siempre', async () => {
    // Asistencia de otra ocurrencia del mismo turno, que no es de este pago: no cuenta.
    armar({ precios: new Map([[2, 8000]]), asistencias: [[41, '2026-09-28', 'PRESENTE']] })

    await expect(service.previa(31)).resolves.toMatchObject({ pago: { id: 31, cantidad: 4 } })
    await expect(service.anular(pedido(), actor)).resolves.toEqual({ pagoId: 31, cantidad: 4 })
    expect(base[0]?.estado).toBe('ANULADO')
  })

  it('asistencia registrada entre el chequeo previo y el lock → 409 y no se escribe nada', async () => {
    // El profesor registra mientras la mesa confirma: entra en la cola del lock antes que la
    // anulación, así que el chequeo previo no la ve y la relectura bajo el lock, sí.
    const registrando = memoria.registrarAsistencia(41, '2026-10-12', 'PRESENTE')
    const anulando = service.anular(pedido(), actor)

    const error = await errorDe(anulando)
    await registrando

    const leido = await memoria.repository.leerPago.mock.results[0]?.value
    expect(leido?.turnos.every((t: { asistencia: unknown }) => t.asistencia === null)).toBe(true)
    expect(memoria.repository.anular).toHaveBeenCalledTimes(1)
    expect(error.code).toBe('TURNOS_DICTADOS')
    expect(error.details).toEqual([
      { fecha: '2026-10-12', materia: matematica, asistencia: 'PRESENTE' },
    ])
    sinEscrituras()
  })

  it('un pago ya anulado sigue dando PAGO_ANULADO, aunque tenga turnos dictados', async () => {
    await service.anular(pedido(), actor)
    await memoria.registrarAsistencia(41, '2026-10-05', 'PRESENTE')

    expect((await errorDe(service.previa(31))).code).toBe('PAGO_ANULADO')
    expect((await errorDe(service.anular(pedido(), actor))).code).toBe('PAGO_ANULADO')
  })
})

describe('previa', () => {
  it('el resumen del pago y, sin nada que avisar, los tres avisos vacíos', async () => {
    const res = await service.previa(31)

    expect(res).toEqual({
      pago: { id: 31, numeroComprobante: 123, alumno: juan, total: 32000, cantidad: 4 },
      avisos: { deuda: null, precios: [], transferenciaCompartida: null },
    })
  })

  it('pago inexistente → 404', async () => {
    expect(await errorDe(service.previa(999))).toBeInstanceOf(NotFoundError)
  })

  it('pago ya anulado → 409 PAGO_ANULADO', async () => {
    await service.anular(pedido(), actor)

    expect((await errorDe(service.previa(31))).code).toBe('PAGO_ANULADO')
  })

  it('no escribe nada', async () => {
    await service.previa(31)

    expect(memoria.repository.anular).not.toHaveBeenCalled()
    expect(base[0]?.estado).toBe('VIGENTE')
  })

  describe('aviso de deuda', () => {
    const vencidos = [
      { turnoId: 41, fecha: '2026-09-01', materia: matematica, importe: 8000 },
      { turnoId: 41, fecha: '2026-09-15', materia: matematica, importe: 8000 },
      { turnoId: 41, fecha: '2026-09-16', materia: matematica, importe: 8000 },
    ]

    it('suma a su deuda vencida los turnos del pago de hace 30 días o más, a precio vigente', async () => {
      base = [pago({ turnos: vencidos })]
      armar({ deudaVencida: { cantidad: 1, total: 7000 }, precios: new Map([[2, 9000]]) })

      const { avisos } = await service.previa(31)

      // 01/09 y 15/09 (hoy − 30) cuentan; 16/09 no.
      expect(avisos.deuda).toEqual({ cantidad: 3, total: 25000, turnosDelPago: 2 })
    })

    it('un pago sin turnos de hace 30 días y sin deuda vencida no avisa', async () => {
      base = [pago({ turnos: vencidos.slice(2) })]
      armar({ precios: new Map([[2, 8000]]) })

      expect((await service.previa(31)).avisos.deuda).toBeNull()
    })

    it('si ya tenía deuda vencida, avisa igual aunque el pago no sume turnos', async () => {
      armar({ deudaVencida: { cantidad: 2, total: 16000 }, precios: new Map([[2, 8000]]) })

      expect((await service.previa(31)).avisos.deuda).toEqual({
        cantidad: 2,
        total: 16000,
        turnosDelPago: 0,
      })
    })

    it('un turno de una materia sin precio cuenta como turno pero no suma al total', async () => {
      base = [
        pago({
          turnos: [
            { turnoId: 41, fecha: '2026-09-01', materia: matematica, importe: 8000 },
            { turnoId: 50, fecha: '2026-09-02', materia: lengua, importe: 6000 },
          ],
        }),
      ]
      armar({ precios: new Map([[2, 9000]]) })

      expect((await service.previa(31)).avisos.deuda).toEqual({
        cantidad: 2,
        total: 9000,
        turnosDelPago: 2,
      })
    })
  })

  describe('aviso de precio', () => {
    it('por materia, si el precio vigente es distinto del cobrado', async () => {
      armar({ precios: new Map([[2, 9000]]) })

      expect((await service.previa(31)).avisos.precios).toEqual([
        { materia: matematica, cobrado: 8000, vigente: 9000 },
      ])
    })

    it('si el precio no cambió, no avisa', async () => {
      armar({ precios: new Map([[2, 8000]]) })

      expect((await service.previa(31)).avisos.precios).toEqual([])
    })

    it('una entrada por materia, ordenadas por nombre; sólo las que cambiaron', async () => {
      base = [
        pago({
          turnos: [
            { turnoId: 50, fecha: '2026-10-06', materia: lengua, importe: 6000 },
            { turnoId: 41, fecha: '2026-10-05', materia: matematica, importe: 8000 },
            { turnoId: 41, fecha: '2026-10-12', materia: matematica, importe: 8000 },
            { turnoId: 60, fecha: '2026-10-07', materia: fisica, importe: 7000 },
          ],
        }),
      ]
      armar({
        precios: new Map([
          [2, 9000],
          [3, 6500],
          [4, 7000],
        ]),
      })

      expect((await service.previa(31)).avisos.precios).toEqual([
        { materia: lengua, cobrado: 6000, vigente: 6500 },
        { materia: matematica, cobrado: 8000, vigente: 9000 },
      ])
    })

    it('una materia que hoy no tiene precio avisa con vigente null', async () => {
      armar({ precios: new Map([[2, null]]) })

      expect((await service.previa(31)).avisos.precios).toEqual([
        { materia: matematica, cobrado: 8000, vigente: null },
      ])
    })
  })

  describe('aviso de transferencia compartida', () => {
    const transferencia = { operacion: '0004829137', banco: 'Banco Macro' }

    beforeEach(() => {
      base = [
        pago({ transferencia }),
        pago({ id: 32, numeroComprobante: 124, alumno: lucia, transferencia }),
        pago({ id: 33, numeroComprobante: 125, alumno: lucia, transferencia, estado: 'ANULADO' }),
        pago({
          id: 34,
          numeroComprobante: 126,
          transferencia: { operacion: '0004829137', banco: 'Banco Nación' },
        }),
        pago({ id: 35, numeroComprobante: 127, transferencia: null }),
      ]
      armar({ precios: new Map([[2, 8000]]) })
    })

    it('los otros pagos vigentes con la misma operación y banco, con número y alumno', async () => {
      expect((await service.previa(31)).avisos.transferenciaCompartida).toEqual({
        operacion: '0004829137',
        banco: 'Banco Macro',
        pagos: [{ pagoId: 32, numeroComprobante: 124, alumno: lucia }],
      })
    })

    it('anular uno no anula los otros pagos de la transferencia', async () => {
      await service.anular(pedido(), actor)

      expect(base.map((p) => p.estado)).toEqual([
        'ANULADO',
        'VIGENTE',
        'ANULADO',
        'VIGENTE',
        'VIGENTE',
      ])
    })

    it('sin otros pagos, o en un pago que no es transferencia, no avisa', async () => {
      expect((await service.previa(34)).avisos.transferenciaCompartida).toBeNull()
      expect((await service.previa(35)).avisos.transferenciaCompartida).toBeNull()
    })
  })
})
