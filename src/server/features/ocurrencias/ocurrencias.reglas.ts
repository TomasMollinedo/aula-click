import { AppError, ValidationError } from '@/server/errors'
import { MENSAJES_NO_CANCELABLE } from '@/server/features/cancelaciones/cancelaciones.condiciones'
import { limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
import {
  OBSERVACION_CIERRE_SISTEMA,
  agruparHorasSeguidas,
  textosDeHorasSeguidas,
  tieneAsistencia,
  type EstadoOcurrencia,
  type EstadoPagoOcurrencia,
  type Ocurrencia,
  type TipoTurno,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { UsuarioAuditoria } from '@/server/shared/auditoria'
import { sumarDias } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type {
  AsistenciaDeOcurrencia,
  AsistenciaDelPortal,
  HorasSeguidas,
  HorasSeguidasDelPortal,
} from './ocurrencias.validation'

// Reglas puras de `ocurrencias`: sin Prisma y sin `hoy()` (lo recibe quien llama). Las acciones
// miran el pago de la ocurrencia, que ya trae el motor (`Ocurrencia.pago`). Lo que es de otra
// feature no se repite acá: el mensaje de "pagado" es el de `cancelaciones` y el tope de cobro, el
// de `pagos`.

export const MENSAJE_RANGO_INVERTIDO = '`hasta` no puede ser anterior a `desde`'
export const MENSAJE_FUERA_DE_VENTANA = 'El rango tiene que estar dentro del año en curso'

/**
 * Ventana permitida de `GET /ocurrencias` (T-43, acotada al año en curso por T-66: antes era un
 * rango relativo a hoy, 30 días atrás / 56 adelante): cualquier fecha entre el 1 de enero y el 31
 * de diciembre del año de `fechaHoy`. Los valores por defecto (sin `desde`/`hasta`) son también los
 * bordes de la ventana, como antes.
 */
export function ventanaOcurrencias(fechaHoy: string): { desde: string; hasta: string } {
  const anio = fechaHoy.slice(0, 4)
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}

/**
 * El rango pedido está en orden y dentro de la ventana permitida (ver `ventanaOcurrencias`); si
 * no, 400 en `hasta` (mismo criterio que `validarRangoAgenda`: el default depende de `hoy`, así
 * que se valida acá y no en el schema).
 */
export function validarRangoOcurrencias(desde: string, hasta: string, fechaHoy: string): void {
  if (hasta < desde) {
    throw new ValidationError(MENSAJE_RANGO_INVERTIDO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }],
    })
  }
  const ventana = ventanaOcurrencias(fechaHoy)
  if (desde < ventana.desde || hasta > ventana.hasta) {
    throw new ValidationError(MENSAJE_FUERA_DE_VENTANA, {
      details: [{ path: ['hasta'], message: MENSAJE_FUERA_DE_VENTANA }],
    })
  }
}

/** Tope de días de `GET /ocurrencias/mis-turnos` (portal, HU-30), extremos incluidos. */
export const MAX_DIAS_MIS_TURNOS = 31
export const MENSAJE_RANGO_MIS_TURNOS = `El rango no puede superar los ${MAX_DIAS_MIS_TURNOS} días`

/**
 * El rango de `GET /ocurrencias/mis-turnos` está en orden y no supera `MAX_DIAS_MIS_TURNOS` días
 * (extremos incluidos); si no, 400 en `hasta`, como el resto de los rangos de la API.
 */
export function validarRangoMisTurnos(desde: string, hasta: string): void {
  if (hasta < desde) {
    throw new ValidationError(MENSAJE_RANGO_INVERTIDO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }],
    })
  }
  if (hasta > sumarDias(desde, MAX_DIAS_MIS_TURNOS - 1)) {
    throw new ValidationError(MENSAJE_RANGO_MIS_TURNOS, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_MIS_TURNOS }],
    })
  }
}

/** La clave de una ocurrencia en `seleccion`: `turnoId:fecha` (`'31:2026-09-28'`). */
export function claveDeSeleccion(turno: { turnoId: number; fecha: string }): string {
  return `${turno.turnoId}:${turno.fecha}`
}

/**
 * Qué turnos van en el PDF de los turnos de un alumno (T-67). Con `seleccion` (las tildadas en la
 * lista), sólo esas y se ignora `estado`: una selección explícita ya dice qué imprimir; una clave
 * que no está entre los turnos (otro rango, otro alumno) no agrega nada. Sin `seleccion`, los del
 * `estado` pedido, o todos si no se pidió ninguno. Conserva el orden que recibe.
 */
export function filtrarParaDocumento<
  T extends { turnoId: number; fecha: string; estado: EstadoOcurrencia },
>(
  turnos: readonly T[],
  { seleccion, estado }: { seleccion?: readonly string[]; estado?: EstadoOcurrencia },
): T[] {
  if (seleccion) {
    const claves = new Set(seleccion)
    return turnos.filter((turno) => claves.has(claveDeSeleccion(turno)))
  }
  if (estado) return turnos.filter((turno) => turno.estado === estado)
  return [...turnos]
}

/**
 * Una fila de la serie del turno que es de su **misma hora** (`serieId` y `bloqueAgendaId`,
 * decisión T-103): el propio turno y sus otros tramos. Es el conjunto sobre el que actúa
 * "Finalizar" (decisión T-104). Sin el resto de la fila: sólo lo que mira `calcularAcciones`.
 */
export type FilaDeLaHora = {
  /** La guardada (finalizar no la modifica); `null` = sin fin. */
  fechaFin: string | null
  /** Tiene una `FinalizacionRecurrencia`. */
  finalizada: boolean
}

/** Alguna fila de la hora tiene finalización: la hora ya se finalizó, desde cualquier tramo. */
function estaFinalizada(filas: readonly FilaDeLaHora[]): boolean {
  return filas.some((fila) => fila.finalizada)
}

/**
 * La hora sigue vigente si alguna de sus filas no tiene `fechaFin` o no pasó todavía: el mismo
 * criterio con el que `POST /finalizaciones` acepta el pedido (decisión T-75), así que si el botón
 * se ve, el POST no rechaza por "no vigente".
 */
function estaVigente(filas: readonly FilaDeLaHora[], fechaHoy: string): boolean {
  return filas.some((fila) => fila.fechaFin === null || fila.fechaFin >= fechaHoy)
}

export type AccionSimple = { visible: boolean }
/** `motivo`: por qué está deshabilitada (sólo viene cuando se ve y no se puede usar). */
export type AccionCancelar = { visible: boolean; habilitada: boolean; motivo?: string }

export type Acciones = {
  cancelar: AccionCancelar
  finalizar: AccionSimple
  reprogramar: AccionSimple
  registrarPago: AccionSimple
  registrarAsistencia: AccionSimple
}

/**
 * Todas las acciones en `false`/no visibles: lo que ve un `PROFESOR`, que no opera ni cobra (el
 * del turno sólo suma `registrarAsistencia`, que decide el service con `puedeRegistrarAsistencia`).
 */
export const ACCIONES_SIN_PERMISO: Acciones = {
  cancelar: { visible: false, habilitada: false },
  finalizar: { visible: false },
  reprogramar: { visible: false },
  registrarPago: { visible: false },
  registrarAsistencia: { visible: false },
}

/** Lo que `calcularAcciones` mira de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaParaAcciones = {
  fecha: string
  estado: EstadoOcurrencia
  tipo: TipoTurno
  pago: { estado: EstadoPagoOcurrencia }
}

/**
 * Las acciones permitidas sobre una ocurrencia (T-43):
 * - `cancelar` (HU-13): visible si está agendada (que ya implica hoy o posterior: una ocurrencia
 *   pasada y no cancelada es `SIN_REGISTRAR`, nunca `AGENDADO` — `estadoDeOcurrencia` en
 *   `turnos.reglas.ts`). Si además está pagada, se muestra deshabilitada con el `motivo` con el que
 *   `POST /cancelaciones` la rechazaría (definición D: un turno pagado no se cancela).
 * - `finalizar` (HU-14): recurrente, con su hora vigente y sin finalizar. Se mira el conjunto de
 *   `filasDeLaHora` (todos los tramos de esa hora en su serie), no sólo la fila de la ocurrencia:
 *   un tramo anterior de una hora ya finalizada en un tramo posterior no la ofrece, y la otra hora
 *   de la misma serie sí. Sin filas (quien llama no la necesita), no visible. No mira el pago de
 *   esta ocurrencia: las pagadas de la hora se validan al finalizar (409 `TURNOS_PAGADOS`).
 * - `reprogramar` (HU-20): agendada. Una pagada se reprograma igual: el pago acompaña al turno.
 * - `registrarPago` (HU-15): no cancelada, pago `PENDIENTE` y fecha dentro del tope de cobro
 *   (`limiteDeCobro(hoy)`, el de `POST /pagos`; las pasadas no tienen tope), así no se ofrece algo
 *   que la API rechaza con `FUERA_DE_RANGO`. Una materia sin precio sí lo muestra: decide el 409
 *   `SIN_PRECIO` del cobro.
 * - `registrarAsistencia`: nunca. Sólo la ve el profesor del turno, que no pasa por acá.
 */
export function calcularAcciones(
  ocurrencia: OcurrenciaParaAcciones,
  filasDeLaHora: readonly FilaDeLaHora[],
  fechaHoy: string,
): Acciones {
  const agendada = ocurrencia.estado === 'AGENDADO'
  const pagada = ocurrencia.pago.estado === 'PAGADO'
  return {
    cancelar: !agendada
      ? { visible: false, habilitada: false }
      : pagada
        ? { visible: true, habilitada: false, motivo: MENSAJES_NO_CANCELABLE.PAGADO }
        : { visible: true, habilitada: true },
    finalizar: {
      visible:
        ocurrencia.tipo === 'RECURRENTE' &&
        estaVigente(filasDeLaHora, fechaHoy) &&
        !estaFinalizada(filasDeLaHora),
    },
    reprogramar: { visible: agendada },
    registrarPago: {
      visible:
        ocurrencia.estado !== 'CANCELADO' && !pagada && ocurrencia.fecha <= limiteDeCobro(fechaHoy),
    },
    registrarAsistencia: { visible: false },
  }
}

/**
 * La asistencia de la ocurrencia se puede registrar o corregir hoy: tiene plazo (es de hoy o
 * anterior y no está cancelada) y no venció. El plazo lo calcula el motor (`plazoAsistencia`): no
 * se copian las reglas de `asistencias`. Con la asistencia ya registrada también: corregir es
 * volver a guardar con el mismo `PUT /asistencias`.
 */
export function puedeRegistrarAsistencia(ocurrencia: Pick<Ocurrencia, 'plazoAsistencia'>): boolean {
  return ocurrencia.plazoAsistencia !== null && !ocurrencia.plazoAsistencia.vencido
}

/** Lo que `horasSeguidasDelDetalle` mira de cada ocurrencia del día (una `Ocurrencia` lo cumple). */
export type OcurrenciaParaHorasSeguidas = Pick<
  Ocurrencia,
  | 'turnoId'
  | 'fecha'
  | 'alumnoId'
  | 'profesorId'
  | 'materiaId'
  | 'horaInicio'
  | 'horaFin'
  | 'estado'
  | 'asistencia'
  | 'plazoAsistencia'
>

/**
 * Las `horasSeguidas` del detalle de `turnoId` (T-84): el grupo de `agruparHorasSeguidas` que
 * la contiene, entre `ocurrenciasDelDia` (las del alumno en esa fecha). `null` si el grupo es de
 * una sola hora o si la ocurrencia está cancelada (no entra en ningún grupo).
 *
 * Los textos salen de `textosDeHorasSeguidas` (una vez en el grupo y, aparte, los de la hora que
 * cambió): acá no se compara nada. Cada hora conserva su estado; `observacion` es la de un
 * ausente. `registrable` marca las que ofrece "Aplicar también a…": quien mira puede registrar
 * (`puedeRegistrar`, el profesor del turno) y la hora no tiene asistencia ni está vencida. Una ya
 * registrada se corrige desde su propio detalle.
 */
export function horasSeguidasDelDetalle(
  ocurrenciasDelDia: readonly OcurrenciaParaHorasSeguidas[],
  turnoId: number,
  puedeRegistrar: boolean,
): HorasSeguidas | null {
  const grupo = agruparHorasSeguidas(ocurrenciasDelDia).find((g) =>
    g.ocurrencias.some((hora) => hora.turnoId === turnoId),
  )
  if (!grupo || grupo.horas < 2) return null

  const { textos, porHora } = textosDeHorasSeguidas(grupo.ocurrencias)
  return {
    horaInicio: minutosAHora(grupo.horaInicio),
    horaFin: minutosAHora(grupo.horaFin),
    horas: grupo.horas,
    textos,
    ocurrencias: grupo.ocurrencias.map((hora, i) => ({
      turnoId: hora.turnoId,
      fecha: hora.fecha,
      horaInicio: minutosAHora(hora.horaInicio),
      horaFin: minutosAHora(hora.horaFin),
      estado: hora.estado,
      plazoAsistencia: hora.plazoAsistencia && {
        vence: hora.plazoAsistencia.vence,
        vencido: hora.plazoAsistencia.vencido,
      },
      actual: hora.turnoId === turnoId,
      registrable:
        puedeRegistrar && !tieneAsistencia(hora.estado) && puedeRegistrarAsistencia(hora),
      textosPropios: porHora[i] ?? null,
      observacion: hora.estado === 'AUSENTE' ? (hora.asistencia?.observacion ?? null) : null,
    })),
  }
}

export const MENSAJE_USUARIO_ASISTENCIA_NO_ENCONTRADO =
  'La asistencia figura registrada, pero no se encontró quién la registró o la modificó'

/** Lo que `asistenciaDelDetalle` mira de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaParaAsistencia = Pick<Ocurrencia, 'estado' | 'asistencia' | 'plazoAsistencia'>

/**
 * La asistencia guardada que cuenta para la ocurrencia: la de una `REALIZADO` o `AUSENTE`. El
 * estado manda (decisión T-137): una cancelada con una asistencia en la base no la muestra.
 */
function asistenciaRegistrada(ocurrencia: OcurrenciaParaAsistencia) {
  return tieneAsistencia(ocurrencia.estado) ? ocurrencia.asistencia : null
}

/** Un "Sin registrar" con el plazo vencido: cerrado por el sistema (decisión T-138). */
function estaCerradaPorSistema(ocurrencia: OcurrenciaParaAsistencia): boolean {
  return ocurrencia.estado === 'SIN_REGISTRAR' && ocurrencia.plazoAsistencia?.vencido === true
}

/**
 * Los usuarios que el service tiene que resolver para `asistenciaDelDetalle`: quién registró y
 * quién modificó la asistencia, sin repetir. `[]` si no hay una asistencia registrada que mostrar.
 */
export function usuariosDeLaAsistencia(ocurrencia: OcurrenciaParaAsistencia): string[] {
  const asistencia = asistenciaRegistrada(ocurrencia)
  if (!asistencia) return []
  return [...new Set([asistencia.createdById, asistencia.updatedById])]
}

/**
 * La `asistencia` del detalle de una ocurrencia (T-84), de **esa hora**, según su estado:
 * - `REALIZADO` o `AUSENTE` (`tieneAsistencia`): la registrada, con quién y cuándo la registró y la
 *   modificó (los dos siempre, como la auditoría de cualquier entidad), de `usuarios`.
 * - `SIN_REGISTRAR` con el plazo vencido: cerrada por el sistema (decisión T-138), con
 *   `OBSERVACION_CIERRE_SISTEMA` y sin estado ni personas. La fecha del cierre es
 *   `plazoAsistencia.vence`: no hay un instante.
 * - Cualquier otro caso (agendada, sin registrar en plazo, cancelada): `null`.
 *
 * `usuarios` trae los de `usuariosDeLaAsistencia`; si falta alguno (la base no lo permite), 500.
 */
export function asistenciaDelDetalle(
  ocurrencia: OcurrenciaParaAsistencia,
  usuarios: ReadonlyMap<string, UsuarioAuditoria>,
): AsistenciaDeOcurrencia | null {
  const asistencia = asistenciaRegistrada(ocurrencia)
  if (asistencia) {
    const registradaPor = usuarios.get(asistencia.createdById)
    const modificadaPor = usuarios.get(asistencia.updatedById)
    if (!registradaPor || !modificadaPor) {
      throw new AppError(MENSAJE_USUARIO_ASISTENCIA_NO_ENCONTRADO, 500)
    }
    return {
      estado: asistencia.estado,
      trabajado: asistencia.trabajado,
      indicaciones: asistencia.indicaciones,
      observacion: asistencia.observacion,
      registradaPor,
      registradaEl: asistencia.createdAt,
      modificadaPor,
      modificadaEl: asistencia.updatedAt,
      cerradaPorSistema: false,
    }
  }
  if (estaCerradaPorSistema(ocurrencia)) {
    return {
      estado: null,
      trabajado: null,
      indicaciones: null,
      observacion: OBSERVACION_CIERRE_SISTEMA,
      registradaPor: null,
      registradaEl: null,
      modificadaPor: null,
      modificadaEl: null,
      cerradaPorSistema: true,
    }
  }
  return null
}

/**
 * La `asistencia` del detalle del portal (HU-30): la misma forma que decide `asistenciaDelDetalle`
 * (registrada, cerrada por el sistema o `null`), sin auditoría ni observación. Al alumno se le
 * muestran qué se trabajó y las indicaciones.
 */
export function asistenciaDelPortal(
  ocurrencia: OcurrenciaParaAsistencia,
): AsistenciaDelPortal | null {
  const asistencia = asistenciaRegistrada(ocurrencia)
  if (asistencia) {
    return {
      estado: asistencia.estado,
      trabajado: asistencia.trabajado,
      indicaciones: asistencia.indicaciones,
      cerradaPorSistema: false,
    }
  }
  if (estaCerradaPorSistema(ocurrencia)) {
    return { estado: null, trabajado: null, indicaciones: null, cerradaPorSistema: true }
  }
  return null
}

/**
 * Las `horasSeguidas` del portal: las del detalle del personal (`horasSeguidasDelDetalle`, misma
 * regla y mismos textos) sin `registrable` ni `observacion`, que el alumno no ve.
 */
export function horasSeguidasDelPortal(
  horasSeguidas: HorasSeguidas | null,
): HorasSeguidasDelPortal | null {
  return (
    horasSeguidas && {
      horaInicio: horasSeguidas.horaInicio,
      horaFin: horasSeguidas.horaFin,
      horas: horasSeguidas.horas,
      textos: horasSeguidas.textos,
      ocurrencias: horasSeguidas.ocurrencias.map((hora) => ({
        turnoId: hora.turnoId,
        fecha: hora.fecha,
        horaInicio: hora.horaInicio,
        horaFin: hora.horaFin,
        estado: hora.estado,
        plazoAsistencia: hora.plazoAsistencia,
        actual: hora.actual,
        textosPropios: hora.textosPropios,
      })),
    }
  )
}
