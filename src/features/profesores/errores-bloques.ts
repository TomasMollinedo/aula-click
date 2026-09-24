import { nombreDiaSemana } from '@/utils/dias-semana'
import type { ApiError } from '@/utils/fetch-json'

import { interpretarErroresApi } from './errores-api'
import { rangoHoras } from './horario'

// Errores de la API de bloques en lo que muestra la UI (docs/contrato-api.md → Errores). Es el
// único lugar que conoce la forma de sus `details`.

/**
 * Mensaje de "sin aulas libres", idéntico al `message` de `AULA_OCUPADA`: el formulario lo muestra
 * cuando `GET /aulas/disponibles` devuelve `[]`, antes de intentar guardar.
 */
export const MENSAJE_SIN_AULAS =
  'No hay un aula disponible en ese horario. Por favor, elija otro horario.'

/** Campos del formulario de bloques que un 400 `VALIDACION` puede marcar. */
export const CAMPOS_BLOQUE = ['diaSemana', 'horaInicio', 'horaFin', 'aulaId'] as const

export type CampoBloque = (typeof CAMPOS_BLOQUE)[number]

export type ErrorBloque<TCampo extends string = CampoBloque> = {
  /** Mensaje general (`null` si el error se muestra entero en los campos). */
  mensaje: string | null
  /** Detalle legible debajo del mensaje: una línea por hora en conflicto o por fila afectada. */
  lineas: string[]
  /** Campos del formulario que marca un 400, con su mensaje. */
  camposMarcados: { campo: TCampo; mensaje: string }[]
}

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

/** `"Lunes de 9:00 a 10:00"` a partir de un detalle con `diaSemana`, `horaInicio` y `horaFin`. */
function lineaDeHora(detalle: Registro): string | null {
  const { diaSemana, horaInicio, horaFin } = detalle
  if (
    typeof diaSemana !== 'number' ||
    typeof horaInicio !== 'string' ||
    typeof horaFin !== 'string'
  ) {
    return null
  }
  try {
    return `${nombreDiaSemana(diaSemana)} de ${rangoHoras(horaInicio, horaFin)}`
  } catch {
    return null
  }
}

function turnosVigentes(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'turno vigente' : 'turnos vigentes'}`
}

/** Mensajes de una lista de `details` con la forma de Zod (`{ path, message }`). */
function mensajesDeDetalles(details: unknown[]): string[] {
  return details.flatMap((d) => (esRegistro(d) && typeof d.message === 'string' ? [d.message] : []))
}

/**
 * Convierte un error de la API de bloques en lo que muestra la UI. `camposValidos` son los campos
 * del formulario que lo pide (vacío para una acción de fila, como eliminar): un 400 sobre otro
 * campo, o sin campo, pasa al mensaje general.
 *
 * - `BLOQUE_SUPERPUESTO` y `AULA_OCUPADA`: una línea por hora en conflicto (`"Lunes de 9:00 a 10:00"`).
 * - `TURNOS_VIGENTES`: la cantidad (`"2 turnos vigentes"`) al editar o eliminar una hora; al
 *   eliminar un bloque completo, el mensaje de cada fila afectada.
 * - `PROFESOR_INACTIVO` y `PROFESOR_SIN_MATERIAS`: solo el mensaje.
 * - 400 `VALIDACION`: los campos, con `interpretarErroresApi`; lo que no es un campo, al mensaje.
 * - 404 con `details` (baja de un bloque completo): una línea por fila que ya no existe.
 */
export function interpretarErrorBloque<TCampo extends string = CampoBloque>(
  error: ApiError,
  camposValidos: ReadonlySet<TCampo> = new Set<TCampo>(),
): ErrorBloque<TCampo> {
  const details = error.details
  const lista = Array.isArray(details) ? details : []

  switch (error.code) {
    case 'BLOQUE_SUPERPUESTO':
    case 'AULA_OCUPADA':
      return {
        mensaje: error.message,
        lineas: lista.flatMap((d) => {
          const linea = esRegistro(d) ? lineaDeHora(d) : null
          return linea ? [linea] : []
        }),
        camposMarcados: [],
      }

    case 'TURNOS_VIGENTES': {
      if (Array.isArray(details)) {
        return { mensaje: error.message, lineas: mensajesDeDetalles(details), camposMarcados: [] }
      }
      const cantidad = esRegistro(details) ? details.cantidad : undefined
      return {
        mensaje: error.message,
        lineas: typeof cantidad === 'number' ? [turnosVigentes(cantidad)] : [],
        camposMarcados: [],
      }
    }

    case 'VALIDACION': {
      const { errorGeneral, camposMarcados } = interpretarErroresApi(error, camposValidos)
      return { mensaje: errorGeneral, lineas: [], camposMarcados }
    }

    case 'NO_ENCONTRADO':
      return { mensaje: error.message, lineas: mensajesDeDetalles(lista), camposMarcados: [] }

    default: {
      // PROFESOR_INACTIVO, PROFESOR_SIN_MATERIAS, 403 SIN_PERMISO y cualquier otro: el mensaje.
      const { errorGeneral } = interpretarErroresApi(error, camposValidos)
      return { mensaje: errorGeneral ?? error.message, lineas: [], camposMarcados: [] }
    }
  }
}

/** El error en una sola línea de texto, para un toast (`"Mensaje: línea 1; línea 2"`). */
export function textoErrorBloque(error: ApiError): string {
  const { mensaje, lineas } = interpretarErrorBloque(error)
  const base = mensaje ?? error.message
  return lineas.length > 0 ? `${base}: ${lineas.join('; ')}` : base
}
