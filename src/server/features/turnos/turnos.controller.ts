import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { bloquesRepository } from '@/server/features/bloques/bloques.repository'
import { materiasRepository } from '@/server/features/materias/materias.repository'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { turnosRepository } from './turnos.repository'
import type { crearTurnoRoute, disponibilidadRoute, obtenerTurnoRoute } from './turnos.routes'
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

export const obtener: RouteHandler<typeof obtenerTurnoRoute, AppEnv> = async (c) =>
  c.json(await turnosService.obtener(c.req.valid('param').turnoId), 200)
