import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoTurno, nombreArchivoTurnosDelAlumno } from './ocurrencias.documentos'
import { renderizarTurnoPdf, renderizarTurnosDelAlumnoPdf } from './ocurrencias.pdf'
import { ocurrenciasRepository } from './ocurrencias.repository'
import type {
  listarOcurrenciasDelAlumnoRoute,
  obtenerOcurrenciaPdfRoute,
  obtenerOcurrenciaRoute,
  turnosDelAlumnoPdfRoute,
} from './ocurrencias.routes'
import { crearOcurrenciasService } from './ocurrencias.service'

// Recibe el dato ya validado, llama al service y arma la respuesta.
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const ocurrenciasService = crearOcurrenciasService({
  repository: ocurrenciasRepository,
  profesoresRepository,
  alumnosRepository,
})

export const obtenerOcurrencia: RouteHandler<typeof obtenerOcurrenciaRoute, AppEnv> = async (c) => {
  const { turnoId, fecha } = c.req.valid('param')
  return c.json(await ocurrenciasService.obtenerDetalle(turnoId, fecha, c.get('actor')), 200)
}

export const listarOcurrenciasDelAlumno: RouteHandler<
  typeof listarOcurrenciasDelAlumnoRoute,
  AppEnv
> = async (c) => c.json(await ocurrenciasService.listarDelAlumno(c.req.valid('query')), 200)

/** El detalle del turno en PDF: el mismo detalle, con el mismo actor (un profesor, sólo los suyos). */
export const obtenerOcurrenciaPdf: RouteHandler<typeof obtenerOcurrenciaPdfRoute, AppEnv> = async (
  c,
) => {
  const { turnoId, fecha } = c.req.valid('param')
  const turno = await ocurrenciasService.obtenerDetalle(turnoId, fecha, c.get('actor'))
  const pdf = await renderizarTurnoPdf({ turno, ...encabezadoDeDocumento(c.get('user')) })
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoTurno(turno))
  return c.body(cuerpo, 200, headers)
}

/** Los turnos de un alumno en PDF: los del listado, filtrados por la selección o el estado. */
export const turnosDelAlumnoPdf: RouteHandler<typeof turnosDelAlumnoPdfRoute, AppEnv> = async (
  c,
) => {
  const documento = await ocurrenciasService.turnosDelAlumnoParaDocumento(c.req.valid('query'))
  const pdf = await renderizarTurnosDelAlumnoPdf({
    documento,
    ...encabezadoDeDocumento(c.get('user')),
  })
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoTurnosDelAlumno(documento))
  return c.body(cuerpo, 200, headers)
}
