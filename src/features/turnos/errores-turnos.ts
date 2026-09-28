import { nombreDiaSemana } from '@/utils/dias-semana'
import { ApiError } from '@/utils/fetch-json'

import { textoHorario, textoRangoTurno } from './formato-turnos'
import type { CampoTurnoForm, TurnoFormValues } from './turnos.schema'
import type { DetalleAlumnoSuperpuesto, DetalleBloqueLleno, TipoTurno } from './turnos.types'

// Errores del alta de turnos (docs/contrato-api.md → Turnos y Errores) en lo que muestra la UI. Es
// el único lugar que conoce la forma de sus `details`: la pantalla hace un `switch` sobre `tipo` y
// no revisa códigos. Un `details` sin la forma esperada cae a `general` con el `message`.

/** Dónde puede marcar un 400: un campo del formulario o las horas elegidas (`bloqueIds`). */
export type CampoErrorTurno = CampoTurnoForm | 'bloqueIds'

export type ErrorAltaTurno =
  /** Un recurrente con fechas llenas: se puede reenviar con `asignarDondeHayLugar` ("Asignar igual"). */
  | { tipo: 'fechasLlenas'; mensaje: string; lineas: string[] }
  /** Alguna hora sin lugar en ninguna fecha: solo queda buscar otros turnos. */
  | { tipo: 'sinLugar'; mensaje: string; lineas: string[] }
  /** El alumno ya tiene turno en ese horario: una línea por turno en conflicto. */
  | { tipo: 'alumnoSuperpuesto'; mensaje: string; lineas: string[] }
  /** 400 por campo. `mensaje`: lo que no corresponde a un campo, o `null`. */
  | {
      tipo: 'campos'
      camposMarcados: { campo: CampoErrorTurno; mensaje: string }[]
      mensaje: string | null
    }
  /** Profesor, materia u horas que cambiaron desde la búsqueda: hay que volver a buscar. */
  | { tipo: 'volverABuscar'; mensaje: string }
  | { tipo: 'general'; mensaje: string }

const MENSAJE_SIN_PERMISO = 'No tenés permiso para esta operación'
const MENSAJE_SIN_CONEXION = 'No se pudo registrar el turno. Revisá la conexión e intentá de nuevo.'

const CODIGOS_VOLVER_A_BUSCAR = new Set([
  'PROFESOR_INACTIVO',
  'MATERIA_INACTIVA',
  'MATERIA_NO_ASIGNADA',
])

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

function esPersona(valor: unknown): valor is { nombre: string; apellido: string } {
  return esRegistro(valor) && typeof valor.nombre === 'string' && typeof valor.apellido === 'string'
}

function esDetalleBloqueLleno(d: unknown): d is DetalleBloqueLleno {
  return esRegistro(d) && typeof d.message === 'string' && typeof d.sinLugar === 'boolean'
}

function esDetalleSuperpuesto(d: unknown): d is DetalleAlumnoSuperpuesto {
  return (
    esRegistro(d) &&
    (d.tipo === 'RECURRENTE' || d.tipo === 'SESION_UNICA') &&
    typeof d.fechaInicio === 'string' &&
    (d.fechaFin === null || typeof d.fechaFin === 'string') &&
    typeof d.diaSemana === 'number' &&
    typeof d.horaInicio === 'string' &&
    typeof d.horaFin === 'string' &&
    esPersona(d.profesor) &&
    esRegistro(d.materia) &&
    typeof d.materia.nombre === 'string'
  )
}

/** `'Lunes de 9:00 a 10:00 · Física con Sofía Herrera · recurrente desde el 28/09, sin fin'`. */
function lineaSuperpuesto(d: DetalleAlumnoSuperpuesto): string {
  const horario = `${nombreDiaSemana(d.diaSemana)} ${textoHorario(d.horaInicio, d.horaFin)}`
  const materia = `${d.materia.nombre} con ${d.profesor.nombre} ${d.profesor.apellido}`
  return `${horario} · ${materia} · ${textoRangoTurno(d)}`
}

/** Primer elemento del `path` de un detalle con la forma de Zod, o `null`. */
function raizDelPath(d: unknown): unknown {
  return esRegistro(d) && Array.isArray(d.path) ? d.path[0] : null
}

/**
 * El campo del formulario que marca un `path` de la API. En una sesión única el formulario tiene
 * `fecha`, y la API responde en `fechaInicio` (y en `fechaFin`, que para ella es la misma fecha).
 */
function campoDelPath(raiz: unknown, tipo: TipoTurno): CampoErrorTurno | null {
  switch (raiz) {
    case 'bloqueIds':
    case 'motivoConsulta':
      return raiz
    case 'fechaInicio':
    case 'fechaFin':
      return tipo === 'SESION_UNICA' ? 'fecha' : raiz
    default:
      return null
  }
}

function interpretarValidacion(error: ApiError, tipo: TipoTurno): ErrorAltaTurno {
  const details = Array.isArray(error.details) ? error.details : []
  const camposMarcados: { campo: CampoErrorTurno; mensaje: string }[] = []
  let mensaje: string | null = null

  for (const d of details) {
    const texto = esRegistro(d) && typeof d.message === 'string' ? d.message : null
    const campo = campoDelPath(raizDelPath(d), tipo)
    if (campo && texto) {
      // Sesión única: `fechaInicio` y `fechaFin` caen los dos en `fecha`; se marca una vez.
      if (!camposMarcados.some((c) => c.campo === campo))
        camposMarcados.push({ campo, mensaje: texto })
    } else {
      mensaje = mensaje ?? texto
    }
  }

  if (camposMarcados.length === 0) return { tipo: 'general', mensaje: mensaje ?? error.message }
  return { tipo: 'campos', camposMarcados, mensaje }
}

/**
 * Convierte el error del alta en lo que muestra la pantalla. `tipo` es el del formulario enviado,
 * para marcar la fecha de una sesión única en su campo. Acepta cualquier error: uno que no sea un
 * `ApiError` (red) cae a `general`.
 */
export function interpretarErrorAlta(
  error: unknown,
  tipo: TurnoFormValues['tipo'],
): ErrorAltaTurno {
  if (!(error instanceof ApiError)) return { tipo: 'general', mensaje: MENSAJE_SIN_CONEXION }

  if (error.status === 403 && error.code === 'SIN_PERMISO') {
    return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO }
  }
  if (error.status === 400 && error.code === 'VALIDACION') return interpretarValidacion(error, tipo)

  if (error.status === 404) {
    // 404 de horas: `details` por posición en `bloqueIds` (se dieron de baja desde la búsqueda).
    // Alumno, materia o profesor inexistentes vienen con el mismo `code` (`NO_ENCONTRADO`) y sin
    // `details`: solo los distingue el texto de `message`, que no es contrato. Por eso van a
    // `general` y no se decide nada por el mensaje.
    const deHoras =
      Array.isArray(error.details) && error.details.some((d) => raizDelPath(d) === 'bloqueIds')
    return { tipo: deHoras ? 'volverABuscar' : 'general', mensaje: error.message }
  }

  if (error.status !== 409) return { tipo: 'general', mensaje: error.message }

  if (CODIGOS_VOLVER_A_BUSCAR.has(error.code)) {
    return { tipo: 'volverABuscar', mensaje: error.message }
  }

  const details = error.details
  if (error.code === 'BLOQUE_LLENO') {
    if (!Array.isArray(details) || details.length === 0 || !details.every(esDetalleBloqueLleno)) {
      return { tipo: 'general', mensaje: error.message }
    }
    // En una sesión única, `asignarDondeHayLugar` no cambia nada (contrato-api.md → Turnos):
    // reenviar daría el mismo rechazo, así que nunca se ofrece "Asignar igual".
    const sinLugar = tipo === 'SESION_UNICA' || details.some((d) => d.sinLugar)
    return {
      tipo: sinLugar ? 'sinLugar' : 'fechasLlenas',
      mensaje: error.message,
      // El `message` de cada hora ya sigue la HU: no se rearma.
      lineas: details.map((d) => d.message),
    }
  }

  if (error.code === 'ALUMNO_SUPERPUESTO') {
    if (!Array.isArray(details) || details.length === 0 || !details.every(esDetalleSuperpuesto)) {
      return { tipo: 'general', mensaje: error.message }
    }
    try {
      return {
        tipo: 'alumnoSuperpuesto',
        mensaje: error.message,
        lineas: details.map(lineaSuperpuesto),
      }
    } catch {
      // Un día fuera de 1 a 7 o una fecha inválida: no se puede mostrar el detalle.
      return { tipo: 'general', mensaje: error.message }
    }
  }

  return { tipo: 'general', mensaje: error.message }
}
