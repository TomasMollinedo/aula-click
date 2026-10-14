import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/server/shared/actor'
import type { AdjuntosRepository } from '../adjuntos.repository'
import { archivoAGuardar, crearAdjuntosService } from '../adjuntos.service'

// Service de adjuntos (T-95) con el repository falso: sin base ni MinIO. Tipo, firma y tamaño los
// valida la ruta (ver adjuntos.routes.test.ts).

const actor: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }

function pdf(nombre: string, bytes = 10) {
  return new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' })
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
  const repository = { subir: vi.fn<AdjuntosRepository['subir']>() }
  const service = crearAdjuntosService({ repository })

  beforeEach(() => {
    repository.subir.mockReset()
    repository.subir.mockResolvedValue({
      id: 18,
      nombre: 'a.pdf',
      tipo: 'application/pdf',
      bytes: 10,
    })
  })

  it('sube el archivo sin pago, con el actor, y devuelve lo que guardó el repository', async () => {
    expect(await service.subir(pdf('a.pdf'), actor)).toEqual({
      id: 18,
      nombre: 'a.pdf',
      tipo: 'application/pdf',
      bytes: 10,
    })
    expect(repository.subir).toHaveBeenCalledWith(
      { bytes: new Uint8Array(10), tipo: 'application/pdf', nombre: 'a.pdf' },
      actor,
    )
  })
})
