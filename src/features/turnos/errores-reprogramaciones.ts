import { ApiError } from '@/utils/fetch-json'

import { type ErrorAltaTurno, interpretarErrorAlta } from './errores-turnos'

// Errores de `POST /reprogramaciones` (docs/contrato-api.md → Reprogramaciones y Errores) en lo
// que muestra el diálogo. La API usa los mismos códigos y `details` que el alta (`BLOQUE_LLENO`,
// `ALUMNO_SUPERPUESTO`, `PROFESOR_INACTIVO`, `MATERIA_INACTIVA`, `MATERIA_NO_ASIGNADA`), así que
// se interpretan con `interpretarErrorAlta` como una sesión única (la reprogramación mueve una
// sola fecha); acá se reducen a lo que el diálogo puede mostrar.

export type ErrorReprogramacion = Extract<
  ErrorAltaTurno,
  { tipo: 'sinLugar' | 'alumnoSuperpuesto' | 'volverABuscar' | 'general' }
>

const MENSAJE_SIN_CONEXION =
  'No se pudo reprogramar el turno. Revisá la conexión e intentá de nuevo.'

export function interpretarErrorReprogramacion(error: unknown): ErrorReprogramacion {
  if (!(error instanceof ApiError)) return { tipo: 'general', mensaje: MENSAJE_SIN_CONEXION }

  const interpretado = interpretarErrorAlta(error, 'SESION_UNICA')
  switch (interpretado.tipo) {
    case 'sinLugar':
    case 'alumnoSuperpuesto':
    case 'volverABuscar':
    case 'general':
      return interpretado
    // Un 400 por campo (por ejemplo, la fecha de destino) o un rechazo de fechas llenas, que en
    // una sola fecha no se da: se muestra el mensaje de la API.
    case 'campos':
      return {
        tipo: 'general',
        mensaje: interpretado.camposMarcados[0]?.mensaje ?? interpretado.mensaje ?? error.message,
      }
    case 'fechasLlenas':
      return { tipo: 'general', mensaje: interpretado.mensaje }
  }
}
