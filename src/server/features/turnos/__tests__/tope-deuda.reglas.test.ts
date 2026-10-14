import { describe, expect, it } from 'vitest'
import { ConflictError } from '@/server/errors'
import {
  MENSAJE_DEUDA_VENCIDA_PORTAL,
  mensajeDeudaVencidaMesa,
  textoPesos,
  verificarTopeDeuda,
} from '../tope-deuda.reglas'

// Textos y rechazo del tope de deuda (HU-29). Qué es deuda vencida lo prueba `cuentas`
// (`deudaVencida`, T-76); el tope de punta a punta, `turnos.service.test.ts`.

describe('textoPesos', () => {
  it('sin centavos, sin decimales; con centavos, con dos', () => {
    expect(textoPesos(24000)).toBe('$ 24.000')
    expect(textoPesos(8000)).toBe('$ 8.000')
    expect(textoPesos(1234567.5)).toBe('$ 1.234.567,50')
    expect(textoPesos(999.05)).toBe('$ 999,05')
    expect(textoPesos(0)).toBe('$ 0')
  })
})

describe('mensajeDeudaVencidaMesa', () => {
  it('con la cantidad y el total, como en la HU', () => {
    expect(mensajeDeudaVencidaMesa({ cantidad: 3, total: 24000 })).toBe(
      'El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos',
    )
  })

  it('un solo turno, en singular', () => {
    expect(mensajeDeudaVencidaMesa({ cantidad: 1, total: 8000 })).toContain('(1 turno · $ 8.000)')
  })

  it('si los vencidos son de materias sin precio, sin el total', () => {
    expect(mensajeDeudaVencidaMesa({ cantidad: 2, total: 0 })).toContain('(2 turnos)')
  })
})

describe('verificarTopeDeuda', () => {
  it('sin deuda vencida no lanza', () => {
    expect(() => verificarTopeDeuda({ cantidad: 0, total: 0 }, 'x')).not.toThrow()
  })

  it('con deuda vencida: 409 DEUDA_VENCIDA con el mensaje y { cantidad, total }', () => {
    try {
      verificarTopeDeuda({ cantidad: 2, total: 16000 }, MENSAJE_DEUDA_VENCIDA_PORTAL)
      expect.fail('Se esperaba un error')
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError)
      expect(error).toMatchObject({
        statusCode: 409,
        code: 'DEUDA_VENCIDA',
        message: MENSAJE_DEUDA_VENCIDA_PORTAL,
        details: { cantidad: 2, total: 16000 },
      })
    }
  })
})
