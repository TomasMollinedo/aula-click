import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import { detallesPorPosicion } from '@/server/shared/detalles'
import { dateAFecha, diaSemanaISO, fechaADate } from '@/server/shared/fechas'
import type { Estado } from '@/server/shared/estado'
import { minutosAHora } from '@/server/shared/zod'
import type {
  FechasSinTurno,
  PlanReserva,
  SnapshotReserva,
  TipoTurno,
  TurnoDelAlumno,
  TurnoFechas,
  TurnoNuevo,
} from './turnos.validation'

// Reglas puras de turnos (docs/dominio.md → Turnos): qué turno ocupa lugar en una fecha, qué
// fechas de una hora están llenas y cómo se parte un recurrente en tramos, y la decisión de una
// reserva a partir de lo leído bajo lock. Sin Prisma y sin `hoy()`: las fechas son `YYYY-MM-DD`
// (la comparación de textos es la de fechas). Los mensajes y códigos de error viven acá: ni el
// repository ni el service los reescriben.

export const CODIGO_BLOQUE_LLENO = 'BLOQUE_LLENO'
export const CODIGO_ALUMNO_SUPERPUESTO = 'ALUMNO_SUPERPUESTO'
export const CODIGO_PROFESOR_INACTIVO = 'PROFESOR_INACTIVO'
export const CODIGO_MATERIA_INACTIVA = 'MATERIA_INACTIVA'
export const CODIGO_MATERIA_NO_ASIGNADA = 'MATERIA_NO_ASIGNADA'

export const MENSAJE_ALUMNO_SUPERPUESTO = 'El alumno ya tiene un turno en ese horario'
export const MENSAJE_PROFESOR_INACTIVO = 'El profesor está inactivo: no se le pueden asignar turnos'
export const MENSAJE_MATERIA_INACTIVA = 'La materia está inactiva: no se le pueden asignar turnos'
export const MENSAJE_MATERIA_NO_ASIGNADA = 'La materia no está asignada al profesor'
export const MENSAJE_SIN_LUGAR =
  'No hay lugar: alguna de las horas elegidas está completa en todas las fechas pedidas'
export const MENSAJE_FECHAS_SIN_LUGAR =
  'Hay fechas sin lugar: se puede asignar el turno solo en las fechas con lugar, o cancelar'
export const MENSAJE_FECHA_PASADA = 'La fecha no puede ser anterior a hoy'
export const MENSAJE_BLOQUE_NO_ENCONTRADO = 'Bloque no encontrado'
export const MENSAJE_MISMO_PROFESOR = 'Todas las horas deben ser del mismo profesor'
export const MENSAJE_MISMO_DIA = 'Todas las horas deben ser del mismo día'
export const MENSAJE_MATERIA_NO_ENCONTRADA = 'Materia no encontrada'
export const MENSAJE_PROFESOR_NO_ENCONTRADO = 'Profesor no encontrado'

const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Día ISO (1 = lunes … 7 = domingo) → nombre en minúsculas. */
export function nombreDia(diaSemana: number): string {
  return NOMBRES_DIA[diaSemana - 1] ?? String(diaSemana)
}

/** `YYYY-MM-DD` → `DD/MM`. */
function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

/** `HH:mm` sin el cero adelante de la hora (`09:00` → `9:00`), como en la HU. */
function horaCorta(minutos: number): string {
  return minutosAHora(minutos).replace(/^0(\d)/, '$1')
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

function sumarDias(fecha: string, dias: number): string {
  return dateAFecha(new Date(fechaADate(fecha).getTime() + dias * MS_POR_DIA))
}

// ---------------------------------------------------------------------------------------------
// Ocupación
// ---------------------------------------------------------------------------------------------

/**
 * El turno está `ACTIVO` y tiene al menos una fecha en `[inicio, fin]` (`fin` `null` = sin fin).
 * Equivale a `condicionTurnoSeCruzaCon` de `turnos.repository` (hay un test que lo fija).
 */
export function seCruzaCon(turno: TurnoFechas, inicio: string, fin: string | null): boolean {
  return (
    turno.estado === 'ACTIVO' &&
    (fin === null || turno.fechaInicio <= fin) &&
    (turno.fechaFin === null || turno.fechaFin >= inicio)
  )
}

/**
 * **Turno que ocupa lugar** en `fecha` (una sola condición para los dos tipos): `ACTIVO`,
 * `fechaInicio <= fecha` y `fechaFin` nula o `>= fecha`. Una sesión única es el caso
 * `fechaInicio = fechaFin`. Se combina con el `bloqueAgendaId` de la fila. Equivale a
 * `condicionTurnoOcupaLugar` de `turnos.repository`.
 */
export function ocupaLugarEn(turno: TurnoFechas, fecha: string): boolean {
  return seCruzaCon(turno, fecha, fecha)
}

/**
 * Mayor cantidad de `turnos` (de una misma hora) que ocupan lugar en una misma fecha, desde
 * `desde` (la próxima ocurrencia de su día, hoy incluido) en adelante: `{ fecha, cantidad }` de la
 * primera fecha con esa ocupación, o `null` si ninguno ocupa lugar desde ahí. La ocupación solo
 * sube cuando empieza un turno, así que alcanza con evaluar `desde` y cada `fechaInicio`
 * posterior (todas caen en el día de la hora): no se itera fecha por fecha.
 */
export function ocupacionMaxima(
  turnos: readonly TurnoFechas[],
  desde: string,
): { fecha: string; cantidad: number } | null {
  const candidatas = [
    ...new Set([desde, ...turnos.map((t) => t.fechaInicio).filter((f) => f > desde)]),
  ].sort()
  let maxima: { fecha: string; cantidad: number } | null = null
  for (const fecha of candidatas) {
    const cantidad = turnos.filter((turno) => ocupaLugarEn(turno, fecha)).length
    if (cantidad > 0 && (maxima === null || cantidad > maxima.cantidad)) {
      maxima = { fecha, cantidad }
    }
  }
  return maxima
}

export type Tramo = { fechaInicio: string; fechaFin: string | null }

export type AnalisisHora = {
  /** Fechas llenas, finitas y en orden. No repite las que cubre `completoDesde`. */
  fechasLlenas: string[]
  /** Desde esta fecha, todas las siguientes (hasta `fin`) están llenas; `null` si no. */
  completoDesde: string | null
  /** Rachas de fechas consecutivas con lugar. La última puede quedar abierta (`fechaFin = fin`). */
  tramos: Tramo[]
  /** No queda ninguna fecha con lugar. */
  sinLugar: boolean
}

/**
 * Qué fechas de una hora están llenas para un pedido de `inicio` a `fin` (`null` = recurrente
 * sin fin; en una sesión única, `fin = inicio`) y en qué tramos se puede crear el turno. Las
 * ocurrencias son `inicio`, `inicio + 7`, … hasta `fin`; una fecha está llena si los `existentes`
 * que ocupan lugar en ella son `>= capacidad`.
 *
 * No itera sin límite: sea `H` la mayor fecha finita entre `inicio` y las `fechaInicio` y
 * `fechaFin` no nulas de los existentes. Después de `H` la ocupación es constante (los existentes
 * sin fin). Se evalúa fecha por fecha hasta `min(fin, H)` y lo que queda después de `H` (la
 * **cola**) se resuelve en una sola cuenta:
 * - Si `fin <= H` no hay cola: todas las fechas llenas van a `fechasLlenas` y `completoDesde` es
 *   `null`.
 * - Cola llena: `completoDesde` es la primera fecha desde la cual todas las siguientes están
 *   llenas (puede ser anterior a la cola, si las últimas evaluadas también lo estaban), y esas
 *   fechas no se repiten en `fechasLlenas`. Vale igual con `fin` finito o sin fin.
 * - Cola con lugar: el último tramo queda abierto hasta `fin` (que puede ser `null`).
 *
 * `existentes` son los turnos de esa fila que se cruzan con el pedido; los que no están `ACTIVO`
 * no cuentan.
 */
export function analizarHora({
  capacidad,
  existentes,
  inicio,
  fin,
}: {
  capacidad: number
  existentes: readonly TurnoFechas[]
  inicio: string
  fin: string | null
}): AnalisisHora {
  if (fin !== null && fin < inicio) {
    return { fechasLlenas: [], completoDesde: null, tramos: [], sinLugar: true }
  }

  let horizonte = inicio
  for (const turno of existentes) {
    if (turno.fechaInicio > horizonte) horizonte = turno.fechaInicio
    if (turno.fechaFin !== null && turno.fechaFin > horizonte) horizonte = turno.fechaFin
  }
  const limite = fin !== null && fin < horizonte ? fin : horizonte

  const evaluadas: { fecha: string; llena: boolean }[] = []
  for (let fecha = inicio; fecha <= limite; fecha = sumarDias(fecha, 7)) {
    const ocupacion = existentes.filter((turno) => ocupaLugarEn(turno, fecha)).length
    evaluadas.push({ fecha, llena: ocupacion >= capacidad })
  }

  // La primera ocurrencia sin evaluar es > H (si el límite fue H) o > fin (si fue fin).
  const siguiente = sumarDias(evaluadas.at(-1)?.fecha ?? inicio, 7)
  const hayCola = fin === null || siguiente <= fin
  const ocupacionCola = existentes.filter(
    (turno) => turno.estado === 'ACTIVO' && turno.fechaFin === null,
  ).length
  const colaLlena = hayCola && ocupacionCola >= capacidad

  // Con la cola llena, las últimas evaluadas llenas se suman a `completoDesde`.
  let corte = evaluadas.length
  if (colaLlena) {
    while (corte > 0 && evaluadas[corte - 1]?.llena) corte -= 1
  }
  const completoDesde = colaLlena ? (evaluadas[corte]?.fecha ?? siguiente) : null
  const fechasLlenas = evaluadas
    .slice(0, corte)
    .filter((e) => e.llena)
    .map((e) => e.fecha)

  const tramos: Tramo[] = []
  let abierto: Tramo | null = null
  for (const { fecha, llena } of evaluadas.slice(0, corte)) {
    if (llena) {
      abierto = null
    } else if (abierto) {
      abierto.fechaFin = fecha
    } else {
      abierto = { fechaInicio: fecha, fechaFin: fecha }
      tramos.push(abierto)
    }
  }
  if (hayCola && !colaLlena) {
    if (abierto) abierto.fechaFin = fin
    else tramos.push({ fechaInicio: siguiente, fechaFin: fin })
  }

  return { fechasLlenas, completoDesde, tramos, sinLugar: tramos.length === 0 }
}

// ---------------------------------------------------------------------------------------------
// Validaciones compartidas por el service (antes de la transacción) y `planificarReserva`
// (bajo lock): mismo criterio y mismos mensajes en los dos momentos.
// ---------------------------------------------------------------------------------------------

type FilaParaValidar = { id: number; estado: Estado; profesorId: number; diaSemana: number }

/**
 * Las filas pedidas existen, están activas y son del mismo profesor y el mismo día. 404 con
 * `details` por posición si alguna no existe o está inactiva; 400 en `bloqueIds` si son de más de
 * un profesor o de más de un día. Devuelve el profesor y el día.
 */
export function validarFilas(
  bloqueIds: number[],
  filas: readonly FilaParaValidar[],
): { profesorId: number; diaSemana: number } {
  const porId = new Map(filas.map((fila) => [fila.id, fila]))
  const inexistentes = detallesPorPosicion(
    'bloqueIds',
    bloqueIds,
    (id) => porId.get(id)?.estado !== 'ACTIVO',
    (id) => `El bloque ${id} no existe o fue dado de baja`,
  )
  if (inexistentes.length > 0) {
    throw new NotFoundError(MENSAJE_BLOQUE_NO_ENCONTRADO, { details: inexistentes })
  }

  const elegidas = bloqueIds.flatMap((id) => {
    const fila = porId.get(id)
    return fila ? [fila] : []
  })
  const [primera] = elegidas
  // Inalcanzable: el schema exige `min(1)` en `bloqueIds` y todas pasaron el chequeo de arriba.
  // Está para que TypeScript sepa que `primera` existe; por eso no tiene test.
  if (!primera) throw new NotFoundError(MENSAJE_BLOQUE_NO_ENCONTRADO)
  if (elegidas.some((fila) => fila.profesorId !== primera.profesorId)) {
    throw new ValidationError(MENSAJE_MISMO_PROFESOR, {
      details: [{ path: ['bloqueIds'], message: MENSAJE_MISMO_PROFESOR }],
    })
  }
  if (elegidas.some((fila) => fila.diaSemana !== primera.diaSemana)) {
    throw new ValidationError(MENSAJE_MISMO_DIA, {
      details: [{ path: ['bloqueIds'], message: MENSAJE_MISMO_DIA }],
    })
  }
  return { profesorId: primera.profesorId, diaSemana: primera.diaSemana }
}

/** `fechaInicio` y `fechaFin` (si viene) caen en el día de las filas; si no, 400 en el campo. */
export function validarFechasEnDia(
  diaSemana: number,
  fechaInicio: string,
  fechaFin: string | null,
): void {
  const mensaje = `La fecha debe caer en ${nombreDia(diaSemana)}`
  const details = [
    ...(diaSemanaISO(fechaInicio) === diaSemana
      ? []
      : [{ path: ['fechaInicio'], message: mensaje }]),
    ...(fechaFin === null || diaSemanaISO(fechaFin) === diaSemana
      ? []
      : [{ path: ['fechaFin'], message: mensaje }]),
  ]
  if (details.length > 0) throw new ValidationError(mensaje, { details })
}

/** Profesor inexistente (404) o inactivo (409 `PROFESOR_INACTIVO`). */
export function validarProfesor(profesor: { estado: Estado } | null): void {
  if (!profesor) throw new NotFoundError(MENSAJE_PROFESOR_NO_ENCONTRADO)
  if (profesor.estado !== 'ACTIVO') {
    throw new ConflictError(MENSAJE_PROFESOR_INACTIVO, { code: CODIGO_PROFESOR_INACTIVO })
  }
}

/**
 * Materia inexistente (404), inactiva (409 `MATERIA_INACTIVA`, `path` `["materiaId"]`), o sin
 * asignación activa al profesor (409 `MATERIA_NO_ASIGNADA`).
 */
export function validarMateria(
  materia: { estado: Estado } | null,
  asignacion: { estado: Estado } | null,
): void {
  if (!materia) throw new NotFoundError(MENSAJE_MATERIA_NO_ENCONTRADA)
  if (materia.estado !== 'ACTIVO') {
    throw new ConflictError(MENSAJE_MATERIA_INACTIVA, {
      code: CODIGO_MATERIA_INACTIVA,
      details: [{ path: ['materiaId'], message: MENSAJE_MATERIA_INACTIVA }],
    })
  }
  if (asignacion?.estado !== 'ACTIVO') {
    throw new ConflictError(MENSAJE_MATERIA_NO_ASIGNADA, {
      code: CODIGO_MATERIA_NO_ASIGNADA,
      details: [{ path: ['materiaId'], message: MENSAJE_MATERIA_NO_ASIGNADA }],
    })
  }
}

// ---------------------------------------------------------------------------------------------
// Reserva
// ---------------------------------------------------------------------------------------------

/** El pedido ya validado en formato, más el profesor y el día que leyó el service. */
export type PedidoReserva = {
  alumnoId: number
  materiaId: number
  profesorId: number
  diaSemana: number
  bloqueIds: number[]
  tipo: TipoTurno
  fechaInicio: string
  /** `null` = recurrente sin fin. En una sesión única se ignora (se usa `fechaInicio`). */
  fechaFin: string | null
  motivoConsulta: string | null
  asignarDondeHayLugar: boolean
}

function detalleSuperpuesto(turno: TurnoDelAlumno) {
  return {
    turnoId: turno.id,
    tipo: turno.tipo,
    fechaInicio: turno.fechaInicio,
    fechaFin: turno.fechaFin,
    diaSemana: turno.diaSemana,
    horaInicio: minutosAHora(turno.horaInicio),
    horaFin: minutosAHora(turno.horaFin),
    profesor: turno.profesor,
    materia: turno.materia,
  }
}

/** "el lunes 26/10", "los lunes 26/10, 02/11 y 09/11" y/o "desde el lunes 30/11". */
function describirFechas(diaSemana: number, analisis: AnalisisHora): string {
  const dia = nombreDia(diaSemana)
  const fechas = analisis.fechasLlenas.map(diaMes)
  const partes: string[] = []
  if (fechas.length === 1) partes.push(`el ${dia} ${fechas[0]}`)
  if (fechas.length > 1) {
    partes.push(`los ${dia} ${fechas.slice(0, -1).join(', ')} y ${fechas.at(-1)}`)
  }
  if (analisis.completoDesde !== null) {
    partes.push(`desde el ${dia} ${diaMes(analisis.completoDesde)}`)
  }
  return partes.join(', y ')
}

/**
 * Mensaje de una hora con fechas llenas, como en la HU: "La hora de 9:00 a 10:00 está completa
 * el lunes 26/10" (o "completa desde el lunes DD/MM"). Si no tiene lugar en ninguna fecha y eran
 * varias, lo dice así.
 */
function mensajeHora(
  fila: { diaSemana: number; horaInicio: number; horaFin: number },
  analisis: AnalisisHora,
): string {
  const hora = `La hora de ${horaCorta(fila.horaInicio)} a ${horaCorta(fila.horaFin)}`
  const unaSolaFecha = analisis.fechasLlenas.length === 1 && analisis.completoDesde === null
  if (analisis.sinLugar && !unaSolaFecha) {
    return `${hora} no tiene lugar en ninguna de las fechas pedidas`
  }
  return `${hora} está completa ${describirFechas(fila.diaSemana, analisis)}`
}

/**
 * Decide una reserva con lo leído bajo lock (`snapshot`). Orden:
 * 1. Filas que dejaron de estar activas o cambiaron de día o de profesor (404 / 400, como en el
 *    service), fechas fuera del día, profesor inexistente o inactivo (409 `PROFESOR_INACTIVO`),
 *    materia inexistente, inactiva o sin asignación activa (404 / 409).
 * 2. Alumno con un turno que se superpone (mismo día y hora, rangos que se cruzan) → 409
 *    `ALUMNO_SUPERPUESTO`. Rechazo total: ninguna bandera lo saltea.
 * 3. `analizarHora` por cada hora pedida, con la capacidad efectiva `min(profesor, aula)`.
 * 4. Alguna hora sin lugar en ninguna fecha → 409 `BLOQUE_LLENO`, aunque venga la bandera.
 * 5. Alguna hora con fechas llenas y sin `asignarDondeHayLugar` (o en una sesión única) → 409
 *    `BLOQUE_LLENO` con el detalle por hora.
 * 6. Si no: un turno por tramo de cada hora (sin conflictos, un tramo = todo el pedido) y el
 *    resumen de las fechas sin turno.
 */
export function planificarReserva(snapshot: SnapshotReserva, pedido: PedidoReserva): PlanReserva {
  const { bloqueIds, tipo, fechaInicio } = pedido
  const fechaFin = tipo === 'SESION_UNICA' ? fechaInicio : pedido.fechaFin

  // 1. Lo mismo que validó el service, ahora con los locks tomados.
  const { profesorId, diaSemana } = validarFilas(bloqueIds, snapshot.filas)
  if (profesorId !== pedido.profesorId) {
    throw new ValidationError(MENSAJE_MISMO_PROFESOR, {
      details: [{ path: ['bloqueIds'], message: MENSAJE_MISMO_PROFESOR }],
    })
  }
  validarFechasEnDia(diaSemana, fechaInicio, fechaFin)
  validarProfesor(snapshot.profesor)
  validarMateria(snapshot.materia, snapshot.asignacion)
  const capacidadProfesor = snapshot.profesor?.capacidad ?? 0

  // Después de `validarFilas`, cada id pedido tiene su fila (en el orden de `bloqueIds`).
  const filas = new Map(snapshot.filas.map((fila) => [fila.id, fila]))
  const elegidas = bloqueIds.flatMap((id) => {
    const fila = filas.get(id)
    return fila ? [fila] : []
  })
  const horasPedidas = new Set(elegidas.map((fila) => fila.horaInicio))

  // 2. Superposición del alumno.
  const superpuestos = snapshot.turnosAlumno.filter(
    (turno) =>
      turno.diaSemana === diaSemana &&
      horasPedidas.has(turno.horaInicio) &&
      seCruzaCon(turno, fechaInicio, fechaFin),
  )
  if (superpuestos.length > 0) {
    throw new ConflictError(MENSAJE_ALUMNO_SUPERPUESTO, {
      code: CODIGO_ALUMNO_SUPERPUESTO,
      details: superpuestos.map(detalleSuperpuesto),
    })
  }

  // 3. Capacidad por hora y por fecha.
  const horas = elegidas.map((fila) => {
    const capacidadEfectiva = Math.min(capacidadProfesor, fila.aulaCapacidad)
    const analisis = analizarHora({
      capacidad: capacidadEfectiva,
      existentes: snapshot.ocupantes.filter((turno) => turno.bloqueAgendaId === fila.id),
      inicio: fechaInicio,
      fin: fechaFin,
    })
    const conFechasLlenas = analisis.fechasLlenas.length > 0 || analisis.completoDesde !== null
    return { fila, capacidadEfectiva, analisis, conFechasLlenas }
  })
  const porId = new Map(horas.map((hora) => [hora.fila.id, hora]))
  const tieneFechasLlenas = (id: number) => porId.get(id)?.conFechasLlenas === true

  // 4 y 5.
  const algunaSinLugar = horas.some((hora) => hora.analisis.sinLugar)
  const aceptaTramos = pedido.asignarDondeHayLugar && tipo === 'RECURRENTE'
  if (algunaSinLugar || (horas.some((hora) => hora.conFechasLlenas) && !aceptaTramos)) {
    throw new ConflictError(algunaSinLugar ? MENSAJE_SIN_LUGAR : MENSAJE_FECHAS_SIN_LUGAR, {
      code: CODIGO_BLOQUE_LLENO,
      details: detallesPorPosicion(
        'bloqueIds',
        bloqueIds,
        tieneFechasLlenas,
        (id) => {
          const hora = porId.get(id)
          return hora ? mensajeHora(hora.fila, hora.analisis) : ''
        },
        (id) => {
          const hora = porId.get(id)
          return hora
            ? {
                bloqueId: id,
                horaInicio: minutosAHora(hora.fila.horaInicio),
                horaFin: minutosAHora(hora.fila.horaFin),
                capacidadEfectiva: hora.capacidadEfectiva,
                fechas: hora.analisis.fechasLlenas,
                completoDesde: hora.analisis.completoDesde,
                sinLugar: hora.analisis.sinLugar,
              }
            : {}
        },
      ),
    })
  }

  // 6. Filas a insertar y resumen.
  const turnos: TurnoNuevo[] = horas.flatMap(({ fila, analisis }) =>
    analisis.tramos.map((tramo) => ({
      bloqueAgendaId: fila.id,
      alumnoId: pedido.alumnoId,
      materiaId: pedido.materiaId,
      tipo,
      estado: 'ACTIVO' as const,
      fechaInicio: tramo.fechaInicio,
      fechaFin: tipo === 'SESION_UNICA' ? tramo.fechaInicio : tramo.fechaFin,
      motivoConsulta: pedido.motivoConsulta,
    })),
  )
  const fechasSinTurno: FechasSinTurno[] = horas
    .filter((hora) => hora.conFechasLlenas)
    .map(({ fila, analisis }) => ({
      bloqueId: fila.id,
      horaInicio: minutosAHora(fila.horaInicio),
      horaFin: minutosAHora(fila.horaFin),
      fechas: analisis.fechasLlenas,
      completoDesde: analisis.completoDesde,
    }))
  return { turnos, fechasSinTurno }
}
