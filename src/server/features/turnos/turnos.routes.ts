import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as turnosController from './turnos.controller'
import {
  ejemploAltaEnTramos,
  ejemploAltaRecurrente,
  ejemploAltaSesionUnica,
  ejemploDetalle,
  ejemploDisponibilidad,
  ejemploErrorAlumnoSuperpuesto,
  ejemploErrorBloqueLleno,
  ejemploErrorDesdeManana,
  ejemploErrorDeudaVencida,
  ejemploErrorFechaFueraDelDia,
  ejemploErrorMiBloqueLleno,
  ejemploErrorMiDeudaVencida,
  ejemploErrorMiSuperposicion,
  ejemploHabilitacion,
  ejemploMiAltaRecurrente,
  ejemploMiAltaSesionUnica,
  ejemploMiDisponibilidad,
  ejemploMisMaterias,
  ejemploTurnoReservado,
} from './turnos.ejemplos'
import {
  crearMiTurnoSchema,
  crearTurnoSchema,
  disponibilidadQuerySchema,
  disponibilidadSchema,
  habilitacionSchema,
  materiasOfertadasSchema,
  miDisponibilidadQuerySchema,
  miDisponibilidadSchema,
  turnoDetalleSchema,
  turnoIdParamsSchema,
  turnoReservadoSchema,
  turnosAltaSchema,
} from './turnos.validation'

// Contrato HTTP de turnos: cada endpoint se declara con createRoute() y se registra acá.
// `/{turnoId}` se registra al final: si no, capturaría `/disponibilidad` y las rutas estáticas de
// `/mis-turnos/…` (y respondería 400, porque el id tiene que ser un entero). Las agendas viven en
// la feature `agendas` (T-30). Los endpoints `mis-turnos` son del portal del alumno (HU-29, rol
// ALUMNO): el alumno sale de la sesión, ninguno recibe un `alumnoId`.

const tags = ['Turnos']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}

const erroresPortal = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError(
    'El rol no es alumno, la cuenta no tiene alumno vinculado o el usuario está inhabilitado (SIN_PERMISO)',
  ),
}

export const disponibilidadRoute = createRoute({
  method: 'get',
  path: '/disponibilidad',
  tags,
  summary: 'Horas disponibles para un turno',
  description:
    'Filas activas de los profesores activos que dictan la materia, agrupadas como bloques (mismo profesor, día y aula, horas contiguas), cada hora con su capacidad efectiva y su ocupación en `fecha` (la pedida o la próxima ocurrencia de ese día, hoy incluido). Las horas llenas vienen igual, con `lleno: true`. Sin paginar; `[]` si no hay opciones (también si `profesorId` no dicta la materia). Orden: profesor (apellido y nombre), día y hora.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: disponibilidadQuerySchema },
  responses: {
    200: {
      description: 'Bloques con sus horas',
      content: {
        'application/json': { schema: disponibilidadSchema, example: ejemploDisponibilidad },
      },
    },
    400: respuestaError(
      'Query inválido, `fecha` anterior a hoy o que no cae en `diaSemana` (VALIDACION)',
    ),
    ...errores,
    404: respuestaError('La materia no existe (NO_ENCONTRADO)'),
    409: respuestaError('La materia está inactiva (MATERIA_INACTIVA, sin details)', {
      error: {
        code: 'MATERIA_INACTIVA',
        message: 'La materia está inactiva: no se le pueden asignar turnos',
      },
    }),
  },
})

export const crearTurnoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Registrar un turno',
  description:
    'Un turno por cada hora elegida (filas del mismo profesor y día), todo o nada. `RECURRENTE` va de `fechaInicio` a `fechaFin` (o sin fin, `null`); `SESION_UNICA`, una fecha. Si un recurrente tiene fechas sin lugar, responde 409 `BLOQUE_LLENO` con las fechas por hora; reenviado con `asignarDondeHayLugar: true`, se crea solo en las fechas con lugar, como varios turnos (tramos), y `fechasSinTurno` informa las salteadas. Sin lugar en ninguna fecha (o una sesión única llena) y `ALUMNO_SUPERPUESTO` se rechazan siempre.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: crearTurnoSchema,
          examples: {
            recurrente: { summary: 'Recurrente con fin', value: ejemploAltaRecurrente },
            sesionUnica: { summary: 'Sesión única, dos horas', value: ejemploAltaSesionUnica },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Turnos creados (uno por hora y tramo) y fechas sin turno',
      content: { 'application/json': { schema: turnosAltaSchema, example: ejemploAltaEnTramos } },
    },
    400: respuestaError(
      'Datos inválidos, fecha pasada, fechas que no caen en el día de las horas, u horas de más de un profesor o día (VALIDACION)',
      ejemploErrorFechaFueraDelDia,
    ),
    ...errores,
    404: respuestaError(
      'El alumno o la materia no existen, o alguna hora no existe o está dada de baja (NO_ENCONTRADO; por posición en `bloqueIds`)',
    ),
    409: {
      description:
        'El alumno tiene deuda vencida (DEUDA_VENCIDA, con `{ cantidad, total }`), hora sin lugar (BLOQUE_LLENO), alumno con un turno en ese horario (ALUMNO_SUPERPUESTO), profesor inactivo (PROFESOR_INACTIVO), materia inactiva (MATERIA_INACTIVA) o no asignada al profesor (MATERIA_NO_ASIGNADA)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            bloqueLleno: { summary: 'Fechas sin lugar', value: ejemploErrorBloqueLleno },
            alumnoSuperpuesto: {
              summary: 'Alumno superpuesto',
              value: ejemploErrorAlumnoSuperpuesto,
            },
            deudaVencida: { summary: 'Deuda vencida', value: ejemploErrorDeudaVencida },
          },
        },
      },
    },
  },
})

// ---------------------------------------------------------------------------------------------
// Portal del alumno (HU-29): `/mis-turnos/…`. Las rutas estáticas van antes de `/{turnoId}`.
// ---------------------------------------------------------------------------------------------

export const habilitacionRoute = createRoute({
  method: 'get',
  path: '/mis-turnos/habilitacion',
  tags,
  summary: 'Si el alumno de la sesión puede sacar un turno',
  description:
    'Para avisarle al alumno antes del paso 1 de "Sacar turno": `habilitado: false` y su `deuda` vencida (turnos adeudados de hace 30 días o más) si tiene; si no, `habilitado: true` y `deuda: null`. Es sólo el aviso: el alta lo vuelve a decidir.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  responses: {
    200: {
      description: 'Habilitación del alumno',
      content: {
        'application/json': { schema: habilitacionSchema, example: ejemploHabilitacion },
      },
    },
    ...erroresPortal,
  },
})

export const misMateriasRoute = createRoute({
  method: 'get',
  path: '/mis-turnos/materias',
  tags,
  summary: 'Materias para sacar un turno',
  description:
    'Paso 1 de "Sacar turno": las materias activas con al menos un profesor activo que la tenga asignada y tenga bloques activos. Sin paginar, por nombre.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  responses: {
    200: {
      description: 'Materias',
      content: {
        'application/json': { schema: materiasOfertadasSchema, example: ejemploMisMaterias },
      },
    },
    ...erroresPortal,
  },
})

export const miDisponibilidadRoute = createRoute({
  method: 'get',
  path: '/mis-turnos/disponibilidad',
  tags,
  summary: 'Horarios para sacar un turno',
  description:
    'La misma búsqueda que `GET /turnos/disponibilidad` (materia obligatoria; día, profesor y fecha opcionales; sólo profesores activos con la materia), desde mañana: cada hora sólo dice si está `disponible` (sin cupos ni ocupación), y cada resultado trae el `valorPorClase` de la materia. Sin `fecha`, la próxima ocurrencia de cada día desde mañana.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: { query: miDisponibilidadQuerySchema },
  responses: {
    200: {
      description: 'Bloques con sus horas',
      content: {
        'application/json': { schema: miDisponibilidadSchema, example: ejemploMiDisponibilidad },
      },
    },
    400: respuestaError(
      'Query inválido, `fecha` de hoy o anterior, o que no cae en `diaSemana` (VALIDACION)',
    ),
    ...erroresPortal,
    404: respuestaError('La materia no existe (NO_ENCONTRADO)'),
    409: respuestaError('La materia está inactiva (MATERIA_INACTIVA, sin details)'),
  },
})

export const crearMiTurnoRoute = createRoute({
  method: 'post',
  path: '/mis-turnos',
  tags,
  summary: 'Sacar un turno (portal del alumno)',
  description:
    'El alta de `POST /turnos` para el alumno de la sesión (sin `alumnoId` ni `observaciones` en el body), con las mismas reglas y fechas desde mañana. Queda "Agendado" sin aprobación, registrado por el usuario del alumno. Un alumno con deuda vencida no saca turnos (409 `DEUDA_VENCIDA`). Con fechas sin lugar en un recurrente, 409 `BLOQUE_LLENO` y se puede reenviar con `asignarDondeHayLugar: true` ("Reservar sólo las fechas con lugar"). Responde el resumen de "Turno reservado", sin cupos, observaciones ni auditoría.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: crearMiTurnoSchema,
          examples: {
            recurrente: { summary: 'Todas las semanas, sin fin', value: ejemploMiAltaRecurrente },
            sesionUnica: { summary: 'Una sola clase', value: ejemploMiAltaSesionUnica },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description:
        'Turno reservado: los turnos creados (uno por hora y tramo) y las fechas sin turno',
      content: {
        'application/json': { schema: turnoReservadoSchema, example: ejemploTurnoReservado },
      },
    },
    400: respuestaError(
      'Datos inválidos, fecha de hoy o anterior ("Los turnos se sacan desde el día siguiente"), fechas que no caen en el día de las horas, u horas de más de un profesor o día (VALIDACION)',
      ejemploErrorDesdeManana,
    ),
    ...erroresPortal,
    404: respuestaError(
      'La materia no existe, o alguna hora no existe o está dada de baja (NO_ENCONTRADO; por posición en `bloqueIds`)',
    ),
    409: {
      description:
        'Deuda vencida (DEUDA_VENCIDA), hora sin lugar (BLOQUE_LLENO, sin la capacidad), un turno suyo en ese horario (ALUMNO_SUPERPUESTO, "Ya tenés un turno ese día en ese horario"), profesor inactivo (PROFESOR_INACTIVO), materia inactiva (MATERIA_INACTIVA) o no asignada al profesor (MATERIA_NO_ASIGNADA)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
          examples: {
            deudaVencida: { summary: 'Deuda vencida', value: ejemploErrorMiDeudaVencida },
            bloqueLleno: { summary: 'Fechas sin lugar', value: ejemploErrorMiBloqueLleno },
            alumnoSuperpuesto: {
              summary: 'Ya tiene un turno en ese horario',
              value: ejemploErrorMiSuperposicion,
            },
          },
        },
      },
    },
  },
})

export const obtenerTurnoRoute = createRoute({
  method: 'get',
  path: '/{turnoId}',
  tags,
  summary: 'Detalle de un turno',
  description:
    'Alumno, profesor, materia, aula, día, horario, fechas, motivo, estado (`ACTIVO` se muestra como "Agendado") y la auditoría. Un recurrente creado con huecos son varios turnos: cada uno tiene su detalle.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: turnoIdParamsSchema },
  responses: {
    200: {
      description: 'Detalle del turno',
      content: { 'application/json': { schema: turnoDetalleSchema, example: ejemploDetalle } },
    },
    400: respuestaError('Id inválido (VALIDACION)'),
    ...errores,
    404: respuestaError('El turno no existe (NO_ENCONTRADO)'),
  },
})

export const turnosRoutes = createRouter()
  .openapi(disponibilidadRoute, turnosController.disponibilidad)
  .openapi(crearTurnoRoute, turnosController.crear)
  .openapi(habilitacionRoute, turnosController.habilitacion)
  .openapi(misMateriasRoute, turnosController.misMaterias)
  .openapi(miDisponibilidadRoute, turnosController.miDisponibilidad)
  .openapi(crearMiTurnoRoute, turnosController.crearMiTurno)
  .openapi(obtenerTurnoRoute, turnosController.obtener)
