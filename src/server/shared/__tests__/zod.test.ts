import { z } from '@hono/zod-openapi'
import { describe, expect, it } from 'vitest'
import {
  diaSemana,
  diaSemanaQuery,
  dni,
  email,
  fechaISO,
  horaAMinutos,
  horaHHmm,
  minutosAHora,
  nombrePersona,
  partirEnHoras,
  rangoHorasEnPunto,
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
  it('acepta solo dígitos y los devuelve recortados', () => {
    expect(telefono.parse('  3874123456 ')).toBe('3874123456')
  })

  it.each(['+54 387 4123456', '(387) 4123456', '387-412-3456', '387 412 3456', '387 412 ABCD'])(
    'rechaza %o con mensaje en español',
    (valor) => {
      expect(mensaje(telefono.safeParse(valor))).toBe('El teléfono solo puede tener números')
    },
  )

  it('acepta de 8 a 20 dígitos', () => {
    expect(mensaje(telefono.safeParse('1234567'))).toBe('El teléfono debe tener al menos 8 dígitos')
    expect(telefono.parse('12345678')).toBe('12345678')
    expect(telefono.parse('1'.repeat(20))).toBe('1'.repeat(20))
    expect(mensaje(telefono.safeParse('1'.repeat(21)))).toBe(
      'El teléfono no puede superar los 20 dígitos',
    )
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

describe('nombrePersona', () => {
  it.each(['Lucía', 'María José', 'Pérez Gil', 'Müller', 'Ñandú'])('acepta %o', (valor) => {
    expect(nombrePersona(100).parse(valor)).toBe(valor)
  })

  it('recorta y respeta el máximo, como textoRequerido', () => {
    expect(nombrePersona(5).parse('  Ana  ')).toBe('Ana')
    expect(nombrePersona(3).safeParse('Lucía').success).toBe(false)
    expect(mensaje(nombrePersona(10).safeParse('   '))).toBe('Campo obligatorio')
  })

  it.each([
    'Juan2',
    '1234',
    'Ana_María',
    'Ana.',
    'Juan\tPérez',
    'Ana@',
    'Pérez-Gil',
    "O'Connor",
    'D’Angelo',
    "- '",
  ])('rechaza %o', (valor) => {
    expect(mensaje(nombrePersona(100).safeParse(valor))).toBe('Solo puede tener letras y espacios')
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

describe('partirEnHoras', () => {
  it('una hora exacta da un solo tramo', () => {
    expect(partirEnHoras('14:00', '15:00')).toEqual([{ horaInicio: 840, horaFin: 900 }])
  })

  it('un rango de varias horas da un tramo por cada una', () => {
    expect(partirEnHoras('14:00', '18:00')).toEqual([
      { horaInicio: 840, horaFin: 900 },
      { horaInicio: 900, horaFin: 960 },
      { horaInicio: 960, horaFin: 1020 },
      { horaInicio: 1020, horaFin: 1080 },
    ])
  })

  it('un rango que empieza a medianoche', () => {
    expect(partirEnHoras('00:00', '02:00')).toEqual([
      { horaInicio: 0, horaFin: 60 },
      { horaInicio: 60, horaFin: 120 },
    ])
  })

  it('lanza RangeError con una hora inválida', () => {
    expect(() => partirEnHoras('25:00', '26:00')).toThrow(RangeError)
  })
})

describe('diaSemana', () => {
  it.each([1, 4, 7])('acepta %i', (dia) => {
    expect(diaSemana.parse(dia)).toBe(dia)
  })

  it.each([0, 8, 1.5, '1'])('rechaza %o', (dia) => {
    expect(diaSemana.safeParse(dia).success).toBe(false)
  })

  it('da el mensaje en español', () => {
    expect(mensaje(diaSemana.safeParse(8))).toBe('Debe ser un día de la semana válido (1 a 7)')
  })
})

describe('diaSemanaQuery', () => {
  it('coerciona el texto del query', () => {
    expect(diaSemanaQuery.parse('3')).toBe(3)
  })

  it.each(['0', '8', '1.5', 'abc', ''])('rechaza %o', (dia) => {
    expect(diaSemanaQuery.safeParse(dia).success).toBe(false)
  })

  it('mismos mensajes que en el body', () => {
    expect(mensaje(diaSemanaQuery.safeParse('8'))).toBe(
      'Debe ser un día de la semana válido (1 a 7)',
    )
  })
})

describe('rangoHorasEnPunto', () => {
  const rango = z
    .object({ horaInicio: horaHHmm, horaFin: horaHHmm })
    .superRefine(rangoHorasEnPunto({ finPosterior: true }))
  const parcial = z
    .object({ horaInicio: horaHHmm, horaFin: horaHHmm })
    .partial()
    .superRefine(rangoHorasEnPunto({ finPosterior: false }))

  // Issues de un safeParse fallido, como `path` + `message`.
  function issues(resultado: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
    return resultado.error?.issues.map(({ path, message }) => ({ path, message })) ?? []
  }

  it('acepta un rango de horas en punto con el fin posterior', () => {
    expect(rango.safeParse({ horaInicio: '14:00', horaFin: '18:00' }).success).toBe(true)
  })

  it('marca cada hora que no es en punto, en su campo', () => {
    expect(issues(rango.safeParse({ horaInicio: '14:30', horaFin: '15:30' }))).toEqual([
      { path: ['horaInicio'], message: 'Debe ser una hora en punto (por ejemplo 14:00)' },
      { path: ['horaFin'], message: 'Debe ser una hora en punto (por ejemplo 15:00)' },
    ])
  })

  it.each([
    ['igual', '15:00', '15:00'],
    ['anterior', '15:00', '14:00'],
  ])('con finPosterior, un fin %s al inicio falla en horaFin', (_caso, horaInicio, horaFin) => {
    expect(issues(rango.safeParse({ horaInicio, horaFin }))).toEqual([
      { path: ['horaFin'], message: 'La hora de fin debe ser posterior a la de inicio' },
    ])
  })

  it('con una hora de formato inválido, solo reporta el error de formato', () => {
    expect(issues(rango.safeParse({ horaInicio: '14:00', horaFin: '25:00' }))).toEqual([
      { path: ['horaFin'], message: 'Hora inválida: debe tener formato HH:mm (00:00 a 23:59)' },
    ])
  })

  it('sin finPosterior no compara el orden y acepta horas ausentes', () => {
    expect(parcial.safeParse({ horaInicio: '15:00', horaFin: '14:00' }).success).toBe(true)
    expect(parcial.safeParse({ horaFin: '16:00' }).success).toBe(true)
    expect(issues(parcial.safeParse({ horaInicio: '14:30' }))).toEqual([
      { path: ['horaInicio'], message: 'Debe ser una hora en punto (por ejemplo 14:00)' },
    ])
  })
})
