import { describe, expect, it } from 'vitest'
import {
  dni,
  email,
  fechaISO,
  horaAMinutos,
  horaHHmm,
  minutosAHora,
  telefono,
  textoRequerido,
} from '../zod'

// Primer mensaje de error de un safeParse fallido.
function mensaje(resultado: { error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message
}

describe('dni', () => {
  it('quita puntos y espacios y devuelve solo dígitos', () => {
    expect(dni.parse('30.123.456')).toBe('30123456')
    expect(dni.parse(' 30 123 456 ')).toBe('30123456')
  })

  it('acepta 7 y 8 dígitos', () => {
    expect(dni.parse('1234567')).toBe('1234567')
    expect(dni.parse('12345678')).toBe('12345678')
  })

  it.each(['123456', '123456789', '30.12A.456', ''])('rechaza %o', (valor) => {
    expect(dni.safeParse(valor).success).toBe(false)
  })

  it('da el mensaje en español', () => {
    expect(mensaje(dni.safeParse('123'))).toBe('El DNI debe tener 7 u 8 dígitos')
  })
})

describe('email', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(email.parse('  Ana.Perez@Mail.com ')).toBe('ana.perez@mail.com')
  })

  it('acepta 254 caracteres y rechaza 255 (medidos después del trim)', () => {
    const de254 = `${'a'.repeat(242)}@example.com`
    expect(de254).toHaveLength(254)
    expect(email.parse(`  ${de254}  `)).toBe(de254)
    expect(email.safeParse(`b${de254}`).success).toBe(false)
  })

  it('rechaza un email inválido con mensaje en español', () => {
    expect(mensaje(email.safeParse('ana.perez'))).toBe('Email inválido')
  })
})

describe('telefono', () => {
  it('devuelve lo que escribió el usuario, solo recortado', () => {
    expect(telefono.parse('  (387) 15-412-3456 ')).toBe('(387) 15-412-3456')
    expect(telefono.parse('+54 387 4123456')).toBe('+54 387 4123456')
  })

  it('rechaza 7 dígitos aunque tenga 8 caracteres', () => {
    const resultado = telefono.safeParse('123-4567')
    expect(resultado.success).toBe(false)
    expect(mensaje(resultado)).toBe('El teléfono debe tener al menos 8 dígitos')
  })

  it('rechaza letras', () => {
    expect(mensaje(telefono.safeParse('387 412 ABCD'))).toBe(
      'El teléfono solo puede tener dígitos, espacios, +, - y paréntesis',
    )
  })

  it('acepta de 8 a 20 caracteres', () => {
    expect(telefono.safeParse('1234567').success).toBe(false)
    expect(telefono.parse('1'.repeat(20))).toBe('1'.repeat(20))
    expect(telefono.safeParse('1'.repeat(21)).success).toBe(false)
  })
})

describe('textoRequerido', () => {
  it('recorta y respeta el máximo', () => {
    expect(textoRequerido(3).parse('  abc  ')).toBe('abc')
    expect(textoRequerido(3).safeParse('abcd').success).toBe(false)
  })

  it('rechaza un texto vacío, de solo espacios o ausente con "Campo obligatorio"', () => {
    expect(mensaje(textoRequerido(10).safeParse('   '))).toBe('Campo obligatorio')
    expect(mensaje(textoRequerido(10).safeParse(undefined))).toBe('Campo obligatorio')
  })

  it.each([0, -1, 1.5, Number.NaN])('lanza RangeError con max %s', (max) => {
    expect(() => textoRequerido(max)).toThrow(RangeError)
  })
})

describe('fechaISO', () => {
  it('devuelve el mismo string, no un Date', () => {
    expect(fechaISO.parse('2026-09-22')).toBe('2026-09-22')
    expect(fechaISO.parse('2028-02-29')).toBe('2028-02-29')
  })

  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '22/09/2026', '2026-9-22'])(
    'rechaza %s',
    (valor) => {
      expect(fechaISO.safeParse(valor).success).toBe(false)
    },
  )

  it('da el mensaje en español', () => {
    expect(mensaje(fechaISO.safeParse('2026-02-30'))).toBe(
      'Fecha inválida: debe ser una fecha real con formato AAAA-MM-DD',
    )
  })
})

describe('horaHHmm', () => {
  it.each(['00:00', '09:30', '23:59'])('acepta %s', (hora) => {
    expect(horaHHmm.parse(hora)).toBe(hora)
  })

  it.each(['9:30', '24:00', '12:60', '09:30:00', ''])('rechaza %o', (hora) => {
    expect(horaHHmm.safeParse(hora).success).toBe(false)
  })

  it('da el mensaje en español', () => {
    expect(mensaje(horaHHmm.safeParse('24:00'))).toBe(
      'Hora inválida: debe tener formato HH:mm (00:00 a 23:59)',
    )
  })
})

describe('horaAMinutos', () => {
  it.each([
    ['00:00', 0],
    ['09:30', 570],
    ['23:59', 1439],
  ])('%s → %i', (hora, minutos) => {
    expect(horaAMinutos(hora)).toBe(minutos)
  })

  it.each(['9:30', '24:00', '12:60', 'abc'])('lanza RangeError con %o', (hora) => {
    expect(() => horaAMinutos(hora)).toThrow(RangeError)
  })
})

describe('minutosAHora', () => {
  it.each([
    [0, '00:00'],
    [570, '09:30'],
    [1439, '23:59'],
  ])('%i → %s', (minutos, hora) => {
    expect(minutosAHora(minutos)).toBe(hora)
  })

  it.each([-1, 1440, 9.5, Number.NaN])('lanza RangeError con %s', (minutos) => {
    expect(() => minutosAHora(minutos)).toThrow(RangeError)
  })

  it('es la inversa de horaAMinutos', () => {
    for (const hora of ['00:00', '09:30', '23:59']) {
      expect(minutosAHora(horaAMinutos(hora))).toBe(hora)
    }
    for (let minutos = 0; minutos < 1440; minutos++) {
      expect(horaAMinutos(minutosAHora(minutos))).toBe(minutos)
    }
  })
})
