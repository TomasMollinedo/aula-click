import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import {
  agruparHorasSeguidas,
  plazoDeAsistencia,
  PLAZO_ASISTENCIA_DIAS,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { hoy, sumarDias, type Reloj } from '@/server/shared/fechas'
import { fechaCorta } from '@/server/shared/formato'
import { minutosAHora } from '@/server/shared/zod'
import type {
  AsistenciasRepository,
  EscrituraAsistencia,
  OcurrenciaDelProfesor,
} from './asistencias.repository'
import type {
  AsistenciasDelDia,
  AsistenciasPendientes,
  AsistenciasQuery,
  AsistenciasRegistradas,
  ClaseAsistencia,
  FilaAsistencia,
  RegistrarAsistencias,
} from './asistencias.validation'

// Reglas de negocio de la asistencia (HU-22). No conoce HTTP ni Prisma: lanza AppError o sus
// subclases. Estados, plazo y horas seguidas salen del motor de `turnos` (T-74): acá no se
// recalculan.

/** Código del 409 al registrar la asistencia de una ocurrencia cancelada. */
export const CODIGO_TURNO_CANCELADO = 'TURNO_CANCELADO'
/** Código del 409 al registrar o corregir una asistencia con el plazo vencido. */
export const CODIGO_FUERA_DE_PLAZO = 'FUERA_DE_PLAZO'

const MENSAJE_SIN_FICHA = 'El usuario no tiene ficha de profesor'
const MENSAJE_FECHA_FUTURA = 'La fecha no puede ser posterior a hoy'
const MENSAJE_FECHA_FUTURA_REGISTRO = 'No se puede registrar la asistencia de una fecha futura'
const MENSAJE_REPETIDA = 'La ocurrencia está repetida en el pedido'
const MENSAJE_AJENO = 'No tenés permiso para registrar la asistencia de este turno'
const MENSAJE_CANCELADO = 'El turno está cancelado: no se puede registrar su asistencia'
const MENSAJE_NO_SEGUIDAS =
  'Las horas de un registro tienen que ser seguidas, del mismo alumno, materia y fecha'

const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo. `getPresignedUrl` se inyecta, como en
 * `profesores`.
 */
export function crearAsistenciasService({
  repository,
  profesoresRepository,
  getPresignedUrl,
  reloj,
}: {
  repository: Pick<AsistenciasRepository, 'leer' | 'ultimasIndicaciones' | 'registrar'>
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario'>
  getPresignedUrl: (key: string) => Promise<string>
  reloj?: Reloj
}) {
  /** El profesor sale del `Actor`, nunca de un parámetro. Sin ficha de profesor → 404. */
  async function profesorDeLaSesion(actor: Actor): Promise<number> {
    const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
    if (profesorId === null) throw new NotFoundError(MENSAJE_SIN_FICHA)
    return profesorId
  }

  /**
   * Las filas de la pantalla: un grupo de horas seguidas por fila (`agruparHorasSeguidas`, que
   * deja afuera las canceladas), con la foto del alumno y sus indicaciones anteriores (una sola
   * consulta para todas). Cada fila lleva el `bloqueAgendaId` de su primera hora.
   */
  async function armarFilas(
    ocurrencias: OcurrenciaDelProfesor[],
  ): Promise<{ bloqueAgendaId: number; fila: FilaAsistencia }[]> {
    const grupos = agruparHorasSeguidas(ocurrencias)
    const indicaciones = await repository.ultimasIndicaciones(
      grupos.map((g) => ({ alumnoId: g.alumnoId, materiaId: g.materiaId, antesDe: g.fecha })),
    )
    const fotos = new Map<string, Promise<string>>()
    const foto = (key: string | null) => {
      if (key === null) return null
      if (!fotos.has(key)) fotos.set(key, getPresignedUrl(key))
      return fotos.get(key) as Promise<string>
    }

    return Promise.all(
      grupos.map(async (grupo, i) => {
        const [primera] = grupo.ocurrencias as [OcurrenciaDelProfesor]
        return {
          bloqueAgendaId: primera.bloqueAgendaId,
          fila: {
            alumno: {
              id: primera.alumno.id,
              apellido: primera.alumno.apellido,
              nombre: primera.alumno.nombre,
              fotoUrl: await foto(primera.alumno.avatarKey),
            },
            materia: primera.materia,
            temas: primera.temas,
            horaInicio: minutosAHora(grupo.horaInicio),
            horaFin: minutosAHora(grupo.horaFin),
            horas: grupo.horas,
            ocurrencias: grupo.ocurrencias.map((o) => ({
              turnoId: o.turnoId,
              fecha: o.fecha,
              horaInicio: minutosAHora(o.horaInicio),
              horaFin: minutosAHora(o.horaFin),
              estado: o.estado,
              asistencia: o.asistencia,
            })),
            indicacionesAnteriores: indicaciones[i] ?? null,
          },
        }
      }),
    )
  }

  /**
   * Lo que se escribe para cada registro, o el error del primero que no se puede registrar.
   * Chequeos de cada registro, en orden: cada ocurrencia existe y es del profesor (403), ninguna
   * está cancelada (409 `TURNO_CANCELADO`), son horas seguidas del mismo alumno, materia y fecha
   * (400) y el plazo no venció (409 `FUERA_DE_PLAZO`). Los textos del registro van en **cada**
   * hora: con `PRESENTE`, `trabajado` e `indicaciones`; con `AUSENTE`, `observacion`.
   */
  function planificar(
    datos: RegistrarAsistencias,
    ocurrencias: OcurrenciaDelProfesor[],
  ): EscrituraAsistencia[] {
    const porClave = new Map(ocurrencias.map((o) => [clave(o.turnoId, o.fecha), o]))
    return datos.registros.flatMap((registro, i) => {
      const horas = registro.ocurrencias.map((pedida) => {
        const ocurrencia = porClave.get(clave(pedida.turnoId, pedida.fecha))
        if (!ocurrencia) throw new ForbiddenError(MENSAJE_AJENO)
        return ocurrencia
      })
      if (horas.some((o) => o.estado === 'CANCELADO')) {
        throw new ConflictError(MENSAJE_CANCELADO, { code: CODIGO_TURNO_CANCELADO })
      }
      if (agruparHorasSeguidas(horas).length !== 1) {
        throw new ValidationError(MENSAJE_NO_SEGUIDAS, {
          details: [{ path: ['registros', i, 'ocurrencias'], message: MENSAJE_NO_SEGUIDAS }],
        })
      }
      const vencida = horas.find((o) => o.plazoAsistencia?.vencido)
      if (vencida?.plazoAsistencia) {
        throw new ConflictError(
          `El plazo para registrar esta asistencia venció el ${fechaCorta(vencida.plazoAsistencia.vence)}`,
          { code: CODIGO_FUERA_DE_PLAZO },
        )
      }
      const presente = registro.estado === 'PRESENTE'
      return horas.map((o) => ({
        turnoId: o.turnoId,
        fecha: o.fecha,
        estado: registro.estado,
        trabajado: presente ? (registro.trabajado ?? null) : null,
        indicaciones: presente ? (registro.indicaciones ?? null) : null,
        observacion: presente ? null : (registro.observacion ?? null),
      }))
    })
  }

  /** 400 por cada ocurrencia de fecha futura o repetida en el pedido, antes de leer la base. */
  function validarPedido(datos: RegistrarAsistencias, fechaHoy: string): void {
    const vistas = new Set<string>()
    const detalles: { path: (string | number)[]; message: string }[] = []
    datos.registros.forEach((registro, i) =>
      registro.ocurrencias.forEach((o, j) => {
        const path = ['registros', i, 'ocurrencias', j]
        if (o.fecha > fechaHoy) {
          detalles.push({ path: [...path, 'fecha'], message: MENSAJE_FECHA_FUTURA_REGISTRO })
        }
        const k = clave(o.turnoId, o.fecha)
        if (vistas.has(k)) detalles.push({ path, message: MENSAJE_REPETIDA })
        vistas.add(k)
      }),
    )
    const [primero] = detalles
    if (primero) throw new ValidationError(primero.message, { details: detalles })
  }

  return {
    /**
     * `GET /asistencias?fecha`: las clases del profesor de la sesión en esa fecha (sin ella, hoy;
     * posterior a hoy → 400). Una clase es una hora de un bloque con al menos un turno no
     * cancelado, en orden horario; cada fila (horas seguidas) va en la clase de su primera hora.
     * Las canceladas no aparecen. Una fecha vencida se devuelve igual, con `editable: false`.
     */
    async delDia(query: AsistenciasQuery, actor: Actor): Promise<AsistenciasDelDia> {
      const fechaHoy = hoy(reloj)
      const fecha = query.fecha ?? fechaHoy
      if (fecha > fechaHoy) {
        throw new ValidationError(MENSAJE_FECHA_FUTURA, {
          details: [{ path: ['fecha'], message: MENSAJE_FECHA_FUTURA }],
        })
      }
      const profesorId = await profesorDeLaSesion(actor)
      const ocurrencias = (
        await repository.leer({ profesorId, desde: fecha, hasta: fecha }, reloj)
      ).filter((o) => o.estado !== 'CANCELADO')

      const clases = new Map<number, ClaseAsistencia>()
      for (const o of ocurrencias) {
        if (clases.has(o.bloqueAgendaId)) continue
        clases.set(o.bloqueAgendaId, {
          bloqueAgendaId: o.bloqueAgendaId,
          horaInicio: minutosAHora(o.horaInicio),
          horaFin: minutosAHora(o.horaFin),
          aula: o.aula,
          filas: [],
        })
      }
      for (const { bloqueAgendaId, fila } of await armarFilas(ocurrencias)) {
        clases.get(bloqueAgendaId)?.filas.push(fila)
      }

      const plazo = plazoDeAsistencia(fecha, fechaHoy)
      return {
        fecha,
        plazo,
        editable: !plazo.vencido,
        clases: [...clases.values()].sort(
          (a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.bloqueAgendaId - b.bloqueAgendaId,
        ),
      }
    },

    /**
     * `GET /asistencias/pendientes`: ocurrencias del profesor de días **anteriores** a hoy, sin
     * asistencia (`SIN_REGISTRAR`) y con el plazo sin vencer; cuántas son y la más antigua.
     */
    async pendientes(actor: Actor): Promise<AsistenciasPendientes> {
      const fechaHoy = hoy(reloj)
      const profesorId = await profesorDeLaSesion(actor)
      const ocurrencias = await repository.leer(
        {
          profesorId,
          desde: sumarDias(fechaHoy, -PLAZO_ASISTENCIA_DIAS),
          hasta: sumarDias(fechaHoy, -1),
        },
        reloj,
      )
      const pendientes = ocurrencias.filter(
        (o) => o.estado === 'SIN_REGISTRAR' && o.plazoAsistencia && !o.plazoAsistencia.vencido,
      )
      const [masAntigua] = pendientes
      return {
        cantidad: pendientes.length,
        masAntiguo: masAntigua?.plazoAsistencia
          ? { fecha: masAntigua.fecha, vence: masAntigua.plazoAsistencia.vence }
          : null,
      }
    },

    /**
     * `PUT /asistencias`: registra o corrige, **todo o nada**. Chequeos, en orden: el body ya lo
     * validó Zod (400); ocurrencias de fecha futura o repetidas (400); profesor de la sesión (404
     * sin ficha); cada registro según `planificar` (403, 409, 400, 409). El chequeo previo es sin
     * lock y da los alumnos a bloquear; `repository.registrar` bloquea, relee y vuelve a decidir
     * con la misma regla antes de escribir. Responde las filas registradas con la forma del `GET`.
     */
    async registrar(datos: RegistrarAsistencias, actor: Actor): Promise<AsistenciasRegistradas> {
      validarPedido(datos, hoy(reloj))
      const profesorId = await profesorDeLaSesion(actor)

      const pedidas = datos.registros.flatMap((r) => r.ocurrencias)
      const fechas = pedidas.map((o) => o.fecha).sort()
      const filtro = {
        profesorId,
        desde: fechas[0] as string,
        hasta: fechas.at(-1) as string,
        turnoIds: [...new Set(pedidas.map((o) => o.turnoId))],
      }
      const claves = new Set(pedidas.map((o) => clave(o.turnoId, o.fecha)))

      const previas = await repository.leer(filtro, reloj)
      planificar(datos, previas)
      const alumnoIds = previas
        .filter((o) => claves.has(clave(o.turnoId, o.fecha)))
        .map((o) => o.alumnoId)

      const registradas = await repository.registrar(
        { alumnoIds, filtro },
        (releidas) => planificar(datos, releidas),
        actor,
        reloj,
      )
      const filas = await armarFilas(
        registradas.filter((o) => claves.has(clave(o.turnoId, o.fecha))),
      )
      return { filas: filas.map((f) => f.fila) }
    },
  }
}

export type AsistenciasService = ReturnType<typeof crearAsistenciasService>
