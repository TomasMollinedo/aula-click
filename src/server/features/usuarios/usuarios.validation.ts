import { z } from '@hono/zod-openapi'
import { LARGO_MAXIMO_PASSWORD } from '@/lib/auth-reglas'
import { ROLES } from '@/server/shared/actor'

// Schemas Zod de entrada y salida de `usuarios` (HU-28). Son la fuente del OpenAPI. El body sólo
// valida que estén los tres campos: las reglas (coinciden, largo, distinta de la actual y del DNI,
// actual correcta) las aplica el service, en el orden de la tarea.

const MENSAJE_OBLIGATORIA = 'Es obligatoria'

const contrasena = (descripcion: string) =>
  z
    .string({ error: MENSAJE_OBLIGATORIA })
    .min(1, { error: MENSAJE_OBLIGATORIA })
    .max(LARGO_MAXIMO_PASSWORD, {
      error: `No puede superar los ${LARGO_MAXIMO_PASSWORD} caracteres`,
    })
    .openapi({ description: descripcion })

/** Body de `PATCH /usuarios/mi-usuario/contrasena`. */
export const cambiarContrasenaSchema = z
  .object({
    actual: contrasena('La contraseña actual'),
    nueva: contrasena(
      'La contraseña nueva: al menos 8 caracteres, distinta de la actual y del DNI',
    ),
    repeticion: contrasena('La contraseña nueva, otra vez'),
  })
  .openapi('ContrasenaCambiar')

export type CambiarContrasena = z.infer<typeof cambiarContrasenaSchema>

/** `GET /usuarios/mi-usuario`: el usuario de la sesión. */
export const miUsuarioSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    apellido: z.string(),
    role: z.enum(ROLES),
    usuario: z.string().nullable().openapi({
      description:
        'Usuario de ingreso del alumno (`null` en los demás roles: ingresan con su email)',
      example: 'jperez456',
    }),
    contrasenaInicial: z.boolean().openapi({
      description:
        'Sigue con la contraseña que puso el sistema (el portal recomienda cambiarla, HU-28)',
    }),
  })
  .openapi('MiUsuario')

export type MiUsuario = z.infer<typeof miUsuarioSchema>

/** Lo que devuelve el repository: `MiUsuario` más el DNI (interno, para la regla de la contraseña). */
export type UsuarioGuardado = MiUsuario & { dni: string }
