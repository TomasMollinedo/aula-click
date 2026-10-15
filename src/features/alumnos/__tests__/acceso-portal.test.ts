import { describe, expect, it } from 'vitest'

import { ApiError } from '@/utils/fetch-json'

import {
  AVISO_CONTRASENA_INICIAL,
  datosParaSugerir,
  mensajeErrorAcceso,
  textoAccesoCreado,
  textoConfirmarRestablecer,
  textoContrasenaRestablecida,
} from '../acceso-portal'
import type { AccesoPortal } from '../alumnos.types'

const acceso: AccesoPortal = {
  usuario: 'jperez456',
  creadoPor: { id: 'usr_mesa', nombre: 'Ana', apellido: 'Pérez' },
  creadoEl: '2026-10-14T13:45:00.000Z',
  restablecidaPor: null,
  restablecidaEl: null,
}

describe('datosParaSugerir', () => {
  it('con nombre, apellido y un DNI de 7 u 8 dígitos (con o sin puntos), sin puntos', () => {
    expect(datosParaSugerir({ nombre: ' Juan ', apellido: 'Pérez', dni: '45.123.456' })).toEqual({
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '45123456',
    })
    expect(datosParaSugerir({ nombre: 'Juan', apellido: 'Pérez', dni: '4512345' })?.dni).toBe(
      '4512345',
    )
  })

  it.each([
    ['sin nombre', { nombre: '  ', apellido: 'Pérez', dni: '45123456' }],
    ['sin apellido', { nombre: 'Juan', apellido: '', dni: '45123456' }],
    ['DNI a medio escribir', { nombre: 'Juan', apellido: 'Pérez', dni: '451' }],
    ['DNI con letras', { nombre: 'Juan', apellido: 'Pérez', dni: '4512345a' }],
  ])('%s: no se pide nada', (_caso, datos) => {
    expect(datosParaSugerir(datos)).toBeNull()
  })
})

describe('textos del acceso', () => {
  it('quién creó el acceso y quién restableció la contraseña, con fecha y hora', () => {
    expect(textoAccesoCreado(acceso)).toMatch(/^Acceso creado por Ana Pérez el 14\/10\/2026/)
    expect(textoContrasenaRestablecida(acceso)).toBeNull()
    expect(
      textoContrasenaRestablecida({
        ...acceso,
        restablecidaPor: { id: 'usr_mesa_2', nombre: 'Laura', apellido: 'Gómez' },
        restablecidaEl: '2026-10-15T12:00:00.000Z',
      }),
    ).toMatch(/^Contraseña restablecida por Laura Gómez el 15\/10\/2026/)
  })

  it('la confirmación y el aviso de la contraseña inicial', () => {
    expect(textoConfirmarRestablecer('jperez456')).toBe(
      'La contraseña de jperez456 volverá a ser su DNI.',
    )
    expect(AVISO_CONTRASENA_INICIAL).toBe(
      'La contraseña inicial es el DNI del alumno (sin puntos). El alumno puede cambiarla desde Configuración en el portal.',
    )
  })

  it('los 409 se muestran con el mensaje de la API; el 403, con el suyo', () => {
    expect(
      mensajeErrorAcceso(new ApiError(409, 'CONFLICTO', 'El alumno ya tiene acceso al portal')),
    ).toBe('El alumno ya tiene acceso al portal')
    expect(mensajeErrorAcceso(new ApiError(403, 'SIN_PERMISO', 'x'))).toBe(
      'No tenés permiso para administrar el acceso al portal',
    )
  })
})
