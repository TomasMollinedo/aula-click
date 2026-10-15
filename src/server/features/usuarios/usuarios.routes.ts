import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import { ROLES } from '@/server/shared/actor'
import * as usuariosController from './usuarios.controller'
import { cambiarContrasenaSchema, miUsuarioSchema } from './usuarios.validation'

// Contrato HTTP de usuarios (HU-28, T-91): lo que vale para cualquier usuario sin importar su rol.
// Cada endpoint se declara con createRoute() y se registra acá. El router lo creó T-73 y ya está
// registrado en `app.ts`.

const tags = ['Usuarios']

function respuestaError(description: string) {
  return { description, content: { 'application/json': { schema: ErrorResponseSchema } } }
}

const ejemploMiUsuario = {
  id: 'usr_alumno_01',
  nombre: 'Juan',
  apellido: 'Pérez',
  role: 'ALUMNO',
  usuario: 'jperez456',
  contrasenaInicial: true,
} as const

export const miUsuarioRoute = createRoute({
  method: 'get',
  path: '/mi-usuario',
  tags,
  summary: 'Mi usuario',
  description:
    'El usuario de la sesión: nombre, rol, usuario de ingreso (sólo el alumno) y si sigue con la contraseña inicial, para el aviso del portal "Por seguridad, te recomendamos cambiar tu contraseña".',
  middleware: [requireAuth(), requireRole(...ROLES)] as const,
  responses: {
    200: {
      description: 'Mi usuario',
      content: { 'application/json': { schema: miUsuarioSchema, example: ejemploMiUsuario } },
    },
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El usuario está inhabilitado (USUARIO_INHABILITADO)'),
    404: respuestaError('El usuario no existe (NO_ENCONTRADO)'),
  },
})

export const cambiarContrasenaRoute = createRoute({
  method: 'patch',
  path: '/mi-usuario/contrasena',
  tags,
  summary: 'Cambiar mi contraseña',
  description:
    'En este orden: los tres campos son obligatorios; `nueva` y `repeticion` iguales (400 en `repeticion`); `nueva` de al menos 8 caracteres, distinta de la actual y del DNI (400 en `nueva`); `actual` correcta (400 "La contraseña actual no es correcta" en `actual`). Después deja de ser la contraseña inicial; la sesión sigue abierta. Sólo el alumno en este incremento.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: cambiarContrasenaSchema,
          example: { actual: '45123456', nueva: 'MiClave2026', repeticion: 'MiClave2026' },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contraseña cambiada: mi usuario, con `contrasenaInicial: false`',
      content: {
        'application/json': {
          schema: miUsuarioSchema,
          example: { ...ejemploMiUsuario, contrasenaInicial: false },
        },
      },
    },
    400: respuestaError(
      'Falta un campo, no coinciden, la nueva es corta, igual a la actual o al DNI, o la actual no es correcta (VALIDACION, con `details` en el campo)',
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es alumno o el usuario está inhabilitado (SIN_PERMISO)'),
    404: respuestaError('El usuario no existe (NO_ENCONTRADO)'),
  },
})

export const usuariosRoutes = createRouter()
  .openapi(miUsuarioRoute, usuariosController.miUsuario)
  .openapi(cambiarContrasenaRoute, usuariosController.cambiarContrasena)
