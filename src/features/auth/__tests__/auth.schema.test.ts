import { describe, expect, it } from 'vitest'
import { esEmail, loginSchema } from '../auth.schema'

describe('esEmail', () => {
  it('con @ se ingresa por email; sin @, por usuario', () => {
    expect(esEmail('mesa@aulaclick.local')).toBe(true)
    expect(esEmail('lgonzalez40123456')).toBe(false)
  })
})

describe('loginSchema', () => {
  const valido = (identificador: string) =>
    loginSchema.safeParse({ identificador, password: '12345678' })

  it('acepta un email y un usuario (el usuario lo valida la API)', () => {
    expect(valido('mesa@aulaclick.local').success).toBe(true)
    expect(valido('lgonzalez40123456').success).toBe(true)
    expect(valido('j.fernandez-2').success).toBe(true)
  })

  it('recorta los espacios del identificador', () => {
    const resultado = valido('  lgonzalez  ')
    expect(resultado.success && resultado.data.identificador).toBe('lgonzalez')
  })

  it('un email mal escrito (con @) → "Ingresá un email válido"', () => {
    const resultado = valido('mesa@')
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.message).toBe('Ingresá un email válido')
  })

  it('vacío → "Ingresá tu email o usuario"; sin contraseña → "Ingresá tu contraseña"', () => {
    const resultado = loginSchema.safeParse({ identificador: '   ', password: '' })
    expect(resultado.error?.issues.map((issue) => issue.message)).toEqual([
      'Ingresá tu email o usuario',
      'Ingresá tu contraseña',
    ])
  })
})
