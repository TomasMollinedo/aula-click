import { describe, expect, it } from 'vitest'
import { DATOS_CENTRO } from '../centro.datos'
import { crearCentroService } from '../centro.service'

// Sin tabla y sin dependencias (definición G): se prueba contra el service real, no hace falta
// ningún repository falso.

describe('obtenerDatos', () => {
  it('devuelve el nombre, la dirección y el teléfono del centro', () => {
    const service = crearCentroService()
    expect(service.obtenerDatos()).toEqual(DATOS_CENTRO)
  })
})

describe('obtenerLogo', () => {
  it('el logo existe y tiene el tipo correcto', async () => {
    const service = crearCentroService()
    const logo = await service.obtenerLogo()
    expect(logo.bytes.byteLength).toBeGreaterThan(0)
    expect(logo.contentType).toBe('image/svg+xml')
  })
})
