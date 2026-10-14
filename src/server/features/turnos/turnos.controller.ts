import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { bloquesRepository } from '@/server/features/bloques/bloques.repository'
import { materiasRepository } from '@/server/features/materias/materias.repository'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { turnosRepository } from './turnos.repository'
import type {
  crearMiTurnoRoute,
  crearTurnoRoute,
  disponibilidadRoute,
  habilitacionRoute,
  miDisponibilidadRoute,
  misMateriasRoute,
  obtenerTurnoRoute,
} from './turnos.routes'
import { crearTurnosService } from './turnos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const turnosService = crearTurnosService({
  repository: turnosRepository,
  alumnosRepository,
  bloquesRepository,
  profesoresRepository,
  materiasRepository,
})

export const disponibilidad: RouteHandler<typeof disponibilidadRoute, AppEnv> = async (c) =>
  c.json(await turnosService.disponibilidad(c.req.valid('query')), 200)

export const crear: RouteHandler<typeof crearTurnoRoute, AppEnv> = async (c) =>
  c.json(await turnosService.crear(c.req.valid('json'), c.get('actor')), 201)

// Portal del alumno (HU-29): el alumno sale del actor de la sesión, nunca de la request.

export const habilitacion: RouteHandler<typeof habilitacionRoute, AppEnv> = async (c) =>
  c.json(await turnosService.habilitacion(c.get('actor')), 200)

export const misMaterias: RouteHandler<typeof misMateriasRoute, AppEnv> = async (c) =>
  c.json(await turnosService.misMaterias(c.get('actor')), 200)

export const miDisponibilidad: RouteHandler<typeof miDisponibilidadRoute, AppEnv> = async (c) =>
  c.json(await turnosService.miDisponibilidad(c.req.valid('query'), c.get('actor')), 200)

export const crearMiTurno: RouteHandler<typeof crearMiTurnoRoute, AppEnv> = async (c) =>
  c.json(await turnosService.crearMiTurno(c.req.valid('json'), c.get('actor')), 201)

export const obtener: RouteHandler<typeof obtenerTurnoRoute, AppEnv> = async (c) =>
  c.json(await turnosService.obtener(c.req.valid('param').turnoId), 200)
