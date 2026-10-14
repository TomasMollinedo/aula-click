import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { AdjuntosRepository } from '../adjuntos.repository'
import { archivoAGuardar, crearAdjuntosService } from '../adjuntos.service'
import type { PagoDelAdjunto, UltimoAdjunto } from '../adjuntos.validation'

// Service de adjuntos (T-95) con un repository falso que guarda en memoria los adjuntos de cada
// pago: así se ve qué queda (los reemplazados se conservan, quitar los deja inactivos). Sin base ni
// MinIO. Tipo, firma y tamaño los valida la ruta (ver adjuntos.routes.test.ts).

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

function pdf(nombre: string, bytes = 10) {
  return new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' })
}

type AdjuntoEnMemoria = { id: number; pagoId: number | null; nombre: string; activo: boolean }

const TRANSFERENCIA: PagoDelAdjunto = { estado: 'VIGENTE', tipoFormaPago: 'TRANSFERENCIA' }
const DEBITO: PagoDelAdjunto = { estado: 'VIGENTE', tipoFormaPago: 'DEBITO' }
const EFECTIVO: PagoDelAdjunto = { estado: 'VIGENTE', tipoFormaPago: 'EFECTIVO' }

let pagos: Map<number, PagoDelAdjunto>
let adjuntos: AdjuntoEnMemoria[]
let siguienteId: number

function crearRepository() {
  const ultimo = (pagoId: number): UltimoAdjunto | null => {
    const fila = adjuntos.filter((a) => a.pagoId === pagoId && a.activo).at(-1)
    return (
      (fila && {
        id: fila.id,
        archivoKey: `adjuntos/${fila.id}.pdf`,
        nombre: fila.nombre,
        tipo: 'application/pdf',
        bytes: 10,
        adjuntadoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
        adjuntadoEl: '2026-10-14T13:45:00.000Z',
      }) ??
      null
    )
  }
  return {
    subir: vi.fn<AdjuntosRepository['subir']>(async (archivo) => {
      const id = siguienteId++
      adjuntos.push({ id, pagoId: null, nombre: archivo.nombre, activo: true })
      return { id, nombre: archivo.nombre, tipo: archivo.tipo, bytes: archivo.bytes.byteLength }
    }),
    leerPago: vi.fn<AdjuntosRepository['leerPago']>(async (pagoId) => pagos.get(pagoId) ?? null),
    ultimo: vi.fn<AdjuntosRepository['ultimo']>(async (pagoId) => ultimo(pagoId)),
    reemplazar: vi.fn<AdjuntosRepository['reemplazar']>(async (pagoId, archivo) => {
      adjuntos.push({ id: siguienteId++, pagoId, nombre: archivo.nombre, activo: true })
    }),
    quitar: vi.fn<AdjuntosRepository['quitar']>(async (pagoId) => {
      const activos = adjuntos.filter((a) => a.pagoId === pagoId && a.activo)
      activos.forEach((a) => (a.activo = false))
      return activos.length
    }),
  }
}

let repository: ReturnType<typeof crearRepository>
let service: ReturnType<typeof crearAdjuntosService>
const firmarUrl = vi.fn(
  async (key: string, nombre: string) => `https://minio.local/${key}?n=${nombre}`,
)

beforeEach(() => {
  pagos = new Map([
    [30, TRANSFERENCIA],
    [31, DEBITO],
    [32, EFECTIVO],
    [33, { estado: 'ANULADO', tipoFormaPago: 'TRANSFERENCIA' }],
    [34, DEBITO],
  ])
  // 30 (transferencia) y 31 (débito) con su adjunto; 34 (débito) sin adjunto.
  adjuntos = [
    { id: 1, pagoId: 30, nombre: 'transferencia.pdf', activo: true },
    { id: 2, pagoId: 31, nombre: 'cupon.pdf', activo: true },
    { id: 3, pagoId: 33, nombre: 'anulado.pdf', activo: true },
  ]
  siguienteId = 10
  repository = crearRepository()
  firmarUrl.mockClear()
  service = crearAdjuntosService({ repository, firmarUrl })
})

async function errorDe(promesa: Promise<unknown>): Promise<AppError> {
  return promesa.then(
    () => expect.fail('Se esperaba un error'),
    (error: unknown) => error as AppError,
  )
}

describe('archivoAGuardar', () => {
  it('pasa los bytes, el tipo y el nombre original', async () => {
    expect(await archivoAGuardar(pdf('transferencia septiembre.pdf', 7))).toEqual({
      bytes: new Uint8Array(7),
      tipo: 'application/pdf',
      nombre: 'transferencia septiembre.pdf',
    })
  })

  it('recorta los espacios y los nombres larguísimos; uno vacío pasa a "comprobante"', async () => {
    expect((await archivoAGuardar(pdf('  a.pdf  '))).nombre).toBe('a.pdf')
    expect((await archivoAGuardar(pdf(`${'x'.repeat(300)}.pdf`))).nombre).toHaveLength(200)
    expect((await archivoAGuardar(pdf('   '))).nombre).toBe('comprobante')
  })
})

describe('subir', () => {
  it('sube el archivo sin pago, con el actor, y devuelve lo que guardó el repository', async () => {
    expect(await service.subir(pdf('a.pdf'), actor)).toEqual({
      id: 10,
      nombre: 'a.pdf',
      tipo: 'application/pdf',
      bytes: 10,
    })
    expect(repository.subir).toHaveBeenCalledWith(
      { bytes: new Uint8Array(10), tipo: 'application/pdf', nombre: 'a.pdf' },
      actor,
    )
    expect(adjuntos.at(-1)).toMatchObject({ pagoId: null })
  })
})

describe('verUltimo', () => {
  it('el último activo, con la URL que lo abre en otra pestaña y quién lo adjuntó', async () => {
    expect(await service.verUltimo(30)).toEqual({
      id: 1,
      nombre: 'transferencia.pdf',
      tipo: 'application/pdf',
      bytes: 10,
      url: 'https://minio.local/adjuntos/1.pdf?n=transferencia.pdf',
      adjuntadoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      adjuntadoEl: '2026-10-14T13:45:00.000Z',
    })
    expect(firmarUrl).toHaveBeenCalledWith('adjuntos/1.pdf', 'transferencia.pdf')
  })

  it('un pago anulado lo sigue mostrando', async () => {
    expect((await service.verUltimo(33)).id).toBe(3)
  })

  it('pago inexistente → 404 "Pago no encontrado"', async () => {
    const error = await errorDe(service.verUltimo(99))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('Pago no encontrado')
  })

  it('pago sin adjunto → 404 "El pago no tiene comprobante adjunto"', async () => {
    const error = await errorDe(service.verUltimo(34))
    expect(error).toBeInstanceOf(NotFoundError)
    expect(error.message).toBe('El pago no tiene comprobante adjunto')
  })
})

describe('reemplazar', () => {
  it('adjunta el nuevo, conserva el anterior y muestra el último', async () => {
    const resultado = await service.reemplazar(30, pdf('transferencia-bis.pdf'), actor)

    expect(resultado).toMatchObject({ id: 10, nombre: 'transferencia-bis.pdf' })
    expect(adjuntos.filter((a) => a.pagoId === 30)).toEqual([
      { id: 1, pagoId: 30, nombre: 'transferencia.pdf', activo: true },
      { id: 10, pagoId: 30, nombre: 'transferencia-bis.pdf', activo: true },
    ])
    expect(repository.reemplazar).toHaveBeenCalledWith(
      30,
      { bytes: new Uint8Array(10), tipo: 'application/pdf', nombre: 'transferencia-bis.pdf' },
      actor,
    )
  })

  it('en un pago con débito sin adjunto, lo adjunta', async () => {
    expect((await service.reemplazar(34, pdf('cupon.pdf'), actor)).nombre).toBe('cupon.pdf')
  })

  it('en un débito al que se le quitó el adjunto, el PUT lo vuelve a adjuntar', async () => {
    await service.quitar(31, actor)
    expect((await service.reemplazar(31, pdf('cupon-nuevo.pdf'), actor)).nombre).toBe(
      'cupon-nuevo.pdf',
    )
  })

  it('pago anulado → 409 PAGO_ANULADO, sin adjuntar nada', async () => {
    const error = await errorDe(service.reemplazar(33, pdf('x.pdf'), actor))
    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('PAGO_ANULADO')
    expect(repository.reemplazar).not.toHaveBeenCalled()
  })

  it('pago en efectivo → 409 (no lleva comprobante), sin adjuntar nada', async () => {
    const error = await errorDe(service.reemplazar(32, pdf('x.pdf'), actor))
    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('CONFLICTO')
    expect(error.message).toBe('Un pago en efectivo no lleva comprobante adjunto')
    expect(repository.reemplazar).not.toHaveBeenCalled()
  })

  it('pago inexistente → 404', async () => {
    expect(await errorDe(service.reemplazar(99, pdf('x.pdf'), actor))).toBeInstanceOf(NotFoundError)
  })
})

describe('quitar', () => {
  it('en un pago con débito: lo deja sin adjunto, conserva la fila (inactiva), y GET → 404', async () => {
    await service.quitar(31, actor)

    expect(adjuntos.find((a) => a.id === 2)).toEqual({
      id: 2,
      pagoId: 31,
      nombre: 'cupon.pdf',
      activo: false,
    })
    expect(repository.quitar).toHaveBeenCalledWith(31, actor)
    expect(await errorDe(service.verUltimo(31))).toBeInstanceOf(NotFoundError)
  })

  it('con adjuntos reemplazados, quita todos los activos: no reaparece el anterior', async () => {
    await service.reemplazar(31, pdf('cupon-2.pdf'), actor)

    await service.quitar(31, actor)

    expect(adjuntos.filter((a) => a.pagoId === 31).every((a) => !a.activo)).toBe(true)
    expect(await errorDe(service.verUltimo(31))).toBeInstanceOf(NotFoundError)
  })

  it('pago por transferencia → 409 ADJUNTO_OBLIGATORIO, sin tocar nada', async () => {
    const error = await errorDe(service.quitar(30, actor))
    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe('ADJUNTO_OBLIGATORIO')
    expect(error.message).toBe(
      'Un pago por transferencia no puede quedar sin comprobante: reemplazalo',
    )
    expect(repository.quitar).not.toHaveBeenCalled()
  })

  it('pago anulado → 409 PAGO_ANULADO', async () => {
    expect((await errorDe(service.quitar(33, actor))).code).toBe('PAGO_ANULADO')
    expect(repository.quitar).not.toHaveBeenCalled()
  })

  it.each([
    ['en efectivo', 32],
    ['con débito y sin adjunto', 34],
    ['inexistente', 99],
  ])('pago %s → 404', async (_caso, pagoId) => {
    expect(await errorDe(service.quitar(pagoId, actor))).toBeInstanceOf(NotFoundError)
  })
})
