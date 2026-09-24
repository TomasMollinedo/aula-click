import { swaggerUI } from '@hono/swagger-ui'
import { errorHandler, notFoundHandler } from './errors'
import { createRouter } from './router'
import { alumnosRoutes } from './features/alumnos/alumnos.routes'
import { bloquesRoutes } from './features/bloques/bloques.routes'
import { materiasRoutes } from './features/materias/materias.routes'
import { profesoresRoutes } from './features/profesores/profesores.routes'
import { turnosRoutes } from './features/turnos/turnos.routes'

export const app = createRouter().basePath('/api/v1')

app.onError(errorHandler)
app.notFound(notFoundHandler)

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'Aula Click API', version: '0.1.0' },
})
app.get('/docs', swaggerUI({ url: '/api/v1/openapi.json' }))

// Una línea por feature.
app.route('/alumnos', alumnosRoutes)
app.route('/profesores', profesoresRoutes)
app.route('/materias', materiasRoutes)
app.route('/turnos', turnosRoutes)
app.route('/bloques', bloquesRoutes)
