import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { bloquesRepository } from '@/server/features/bloques/bloques.repository'
import { materiasRepository } from '@/server/features/materias/materias.repository'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { turnosRepository } from './turnos.repository'
import type {
  crearTurnoRoute,
  disponibilidadRoute,
  listarAgendaPropiaRoute,
  listarAgendaRoute,
  listarAulasConTurnoRoute,
  listarMateriasConTurnoRoute,
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

export const listarAgenda: RouteHandler<typeof listarAgendaRoute, AppEnv> = async (c) =>
  c.json(await turnosService.listarAgenda(c.req.valid('query')), 200)

// El profesor sale del Actor de la sesión: nunca de un parámetro (HU-10).
export const listarAgendaPropia: RouteHandler<typeof listarAgendaPropiaRoute, AppEnv> = async (c) =>
  c.json(await turnosService.listarAgendaPropia(c.req.valid('query'), c.get('actor')), 200)

export const listarMateriasConTurno: RouteHandler<
  typeof listarMateriasConTurnoRoute,
  AppEnv
> = async (c) => c.json(await turnosService.listarMateriasConTurno(c.req.valid('query')), 200)

export const listarAulasConTurno: RouteHandler<typeof listarAulasConTurnoRoute, AppEnv> = async (
  c,
) => c.json(await turnosService.listarAulasConTurno(c.req.valid('query')), 200)

export const disponibilidad: RouteHandler<typeof disponibilidadRoute, AppEnv> = async (c) =>
  c.json(await turnosService.disponibilidad(c.req.valid('query')), 200)

export const crear: RouteHandler<typeof crearTurnoRoute, AppEnv> = async (c) =>
  c.json(await turnosService.crear(c.req.valid('json'), c.get('actor')), 201)

export const obtener: RouteHandler<typeof obtenerTurnoRoute, AppEnv> = async (c) =>
  c.json(await turnosService.obtener(c.req.valid('param').turnoId), 200)
