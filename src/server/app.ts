import { swaggerUI } from '@hono/swagger-ui'
import { errorHandler, notFoundHandler } from './errors'
import { createRouter } from './router'
import { agendasRoutes } from './features/agendas/agendas.routes'
import { alumnosRoutes } from './features/alumnos/alumnos.routes'
import { aulasRoutes } from './features/aulas/aulas.routes'
import { bloquesRoutes } from './features/bloques/bloques.routes'
import { cancelacionesRoutes } from './features/cancelaciones/cancelaciones.routes'
import { cuentasRoutes } from './features/cuentas/cuentas.routes'
import { examenesRoutes } from './features/examenes/examenes.routes'
import { finalizacionesRoutes } from './features/finalizaciones/finalizaciones.routes'
import { materiasRoutes } from './features/materias/materias.routes'
import { ocurrenciasRoutes } from './features/ocurrencias/ocurrencias.routes'
import { pagosRoutes } from './features/pagos/pagos.routes'
import { profesoresRoutes } from './features/profesores/profesores.routes'
import { reprogramacionesRoutes } from './features/reprogramaciones/reprogramaciones.routes'
import { tableroRoutes } from './features/tablero/tablero.routes'
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
app.route('/aulas', aulasRoutes)
app.route('/agendas', agendasRoutes)
app.route('/ocurrencias', ocurrenciasRoutes)
app.route('/cancelaciones', cancelacionesRoutes)
app.route('/finalizaciones', finalizacionesRoutes)
app.route('/reprogramaciones', reprogramacionesRoutes)
app.route('/pagos', pagosRoutes)
app.route('/cuentas', cuentasRoutes)
app.route('/examenes', examenesRoutes)
app.route('/tablero', tableroRoutes)
