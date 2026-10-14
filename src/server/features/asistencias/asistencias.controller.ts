import type { RouteHandler } from '@hono/zod-openapi'
import { getPresignedUrl } from '@/lib/storage'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { asistenciasRepository } from './asistencias.repository'
import type {
  asistenciasDelDiaRoute,
  asistenciasPendientesRoute,
  registrarAsistenciasRoute,
} from './asistencias.routes'
import { crearAsistenciasService } from './asistencias.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service los importa como tipo).
const asistenciasService = crearAsistenciasService({
  repository: asistenciasRepository,
  profesoresRepository,
  getPresignedUrl,
})

export const delDia: RouteHandler<typeof asistenciasDelDiaRoute, AppEnv> = async (c) =>
  c.json(await asistenciasService.delDia(c.req.valid('query'), c.get('actor')), 200)

export const pendientes: RouteHandler<typeof asistenciasPendientesRoute, AppEnv> = async (c) =>
  c.json(await asistenciasService.pendientes(c.get('actor')), 200)

export const registrar: RouteHandler<typeof registrarAsistenciasRoute, AppEnv> = async (c) =>
  c.json(await asistenciasService.registrar(c.req.valid('json'), c.get('actor')), 200)
