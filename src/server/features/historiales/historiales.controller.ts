import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import { profesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoHistorial } from './historiales.documentos'
import { renderizarHistorialPdf } from './historiales.pdf'
import { historialesRepository } from './historiales.repository'
import type {
  historialDelAlumnoPdfRoute,
  historialDelAlumnoRoute,
  miMateriaRoute,
  misMateriasRoute,
} from './historiales.routes'
import { crearHistorialesService } from './historiales.service'

// Recibe el dato ya validado, llama al service y arma la respuesta.
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor):
// el del alumno para su nombre y DNI (y el 404) y el del profesor para resolver quién consulta.
const historialesService = crearHistorialesService({
  repository: historialesRepository,
  profesoresRepository,
  alumnosRepository,
})

export const historialDelAlumno: RouteHandler<typeof historialDelAlumnoRoute, AppEnv> = async (
  c,
) => {
  const { alumnoId } = c.req.valid('param')
  return c.json(
    await historialesService.obtenerDelAlumno(alumnoId, c.req.valid('query'), c.get('actor')),
    200,
  )
}

/**
 * El historial del mes en PDF (HU-32): el mismo cálculo del historial, con el encabezado oficial y
 * los headers comunes de los documentos.
 */
export const historialDelAlumnoPdf: RouteHandler<
  typeof historialDelAlumnoPdfRoute,
  AppEnv
> = async (c) => {
  const { alumnoId } = c.req.valid('param')
  const documento = await historialesService.historialParaDocumento(alumnoId, c.req.valid('query'))
  const pdf = await renderizarHistorialPdf({
    documento,
    ...encabezadoDeDocumento(c.get('user')),
  })
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoHistorial(documento))
  return c.body(cuerpo, 200, headers)
}

/** Portal (HU-33): el alumno sale del actor de la sesión. */
export const misMaterias: RouteHandler<typeof misMateriasRoute, AppEnv> = async (c) =>
  c.json(await historialesService.misMaterias(c.get('actor')), 200)

export const miMateria: RouteHandler<typeof miMateriaRoute, AppEnv> = async (c) => {
  const { materiaId, profesorId } = c.req.valid('param')
  return c.json(
    await historialesService.miMateria(materiaId, profesorId, c.req.valid('query'), c.get('actor')),
    200,
  )
}
