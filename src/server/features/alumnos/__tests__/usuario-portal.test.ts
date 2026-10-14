import { describe, expect, it } from 'vitest'
import {
  DOMINIO_EMAIL_ALUMNOS,
  emailDeUsuario,
  MAX_INTENTOS_USUARIO,
  primerUsuarioLibre,
  usuarioBase,
  usuarioConSufijo,
} from '../usuario-portal'

// Usuario del portal (HU-27). La misma regla está en `prisma/seed.ts` (T-72): el caso de la HU
// ("jperez456") fija que los dos dan lo mismo, porque el alumno del seed ingresa con ese usuario.

describe('usuarioBase', () => {
  it('el caso de la HU: inicial del nombre, apellido y últimos 3 dígitos del DNI', () => {
    expect(usuarioBase('Juan', 'Pérez', '45123456')).toBe('jperez456')
  })

  it('saca las tildes y pasa todo a minúsculas', () => {
    expect(usuarioBase('Ángel', 'Gutiérrez', '38777111')).toBe('agutierrez111')
  })

  it('la "ñ" queda como "n"', () => {
    expect(usuarioBase('Ñuño', 'Peña', '40222333')).toBe('npena333')
  })

  it('un apellido compuesto queda sin espacios', () => {
    expect(usuarioBase('María José', 'Fernández de la Colina', '45123456')).toBe(
      'mfernandezdelacolina456',
    )
  })

  it('saca los símbolos de un apellido con apóstrofo o guion', () => {
    expect(usuarioBase('Juan', "O'Connor", '30111222')).toBe('joconnor222')
    expect(usuarioBase('Ana', 'Pérez-Gómez', '30111222')).toBe('aperezgomez222')
  })

  it('un DNI de 7 dígitos también deja los últimos 3', () => {
    expect(usuarioBase('Luis', 'Soto', '9123456')).toBe('lsoto456')
  })
})

describe('usuarioConSufijo', () => {
  it('el primer intento es el base y los siguientes llevan el número', () => {
    expect(usuarioConSufijo('jperez456', 1)).toBe('jperez456')
    expect(usuarioConSufijo('jperez456', 2)).toBe('jperez456-2')
    expect(usuarioConSufijo('jperez456', 3)).toBe('jperez456-3')
  })
})

describe('primerUsuarioLibre', () => {
  it('sin nadie que lo use, el base', () => {
    expect(primerUsuarioLibre('jperez456', [])).toBe('jperez456')
  })

  it('con el base tomado, el sufijo -2', () => {
    expect(primerUsuarioLibre('jperez456', ['jperez456'])).toBe('jperez456-2')
  })

  it('con el base y el -2 tomados, el -3', () => {
    expect(primerUsuarioLibre('jperez456', ['jperez456', 'jperez456-2'])).toBe('jperez456-3')
  })

  it('ignora los usuarios de otra serie que empiezan parecido', () => {
    expect(primerUsuarioLibre('jperez456', ['jperez4567', 'jperez456-10'])).toBe('jperez456')
  })

  it('con todos los intentos tomados, sigue con el siguiente número', () => {
    const tomados = Array.from({ length: MAX_INTENTOS_USUARIO }, (_, i) =>
      usuarioConSufijo('jperez456', i + 1),
    )

    expect(primerUsuarioLibre('jperez456', tomados)).toBe(`jperez456-${MAX_INTENTOS_USUARIO + 1}`)
  })
})

describe('emailDeUsuario', () => {
  it('usa el dominio reservado que no entrega correo', () => {
    expect(emailDeUsuario('jperez456')).toBe(`jperez456@${DOMINIO_EMAIL_ALUMNOS}`)
    expect(DOMINIO_EMAIL_ALUMNOS).toBe('alumnos.aulaclick.invalid')
  })
})
