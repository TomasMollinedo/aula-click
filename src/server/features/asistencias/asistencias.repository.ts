import { prisma } from '@/lib/prisma'
import {
  bloquearAlumno,
  leerOcurrencias,
  type ClienteOcurrencias,
  type EstadoAsistencia,
  type EstadoOcurrencia,
  type PlazoAsistencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { fechaADate, type Reloj } from '@/server/shared/fechas'
import { ultimasIndicaciones, type ConsultaIndicaciones } from './asistencias.condiciones'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: las ocurrencias, su estado y su
// plazo salen del motor de `turnos` (`leerOcurrencias`), nunca de una expansión propia; qué se
// puede registrar lo decide el service, que pasa la regla como callback `verificar`.

/** Timeout más largo que el default de Prisma (5 s): la espera del lock cuenta en la transacción. */
const TRANSACCION_ASISTENCIA = { timeout: 10_000 } as const

/**
 * Una ocurrencia de un profesor con lo que necesita la pantalla "Asistencia": la del motor (horas
 * en minutos, sin `busqueda`) más los temas del turno y la clave de la foto del alumno.
 */
export type OcurrenciaDelProfesor = {
  turnoId: number
  fecha: string
  bloqueAgendaId: number
  horaInicio: number
  horaFin: number
  profesorId: number
  alumnoId: number
  materiaId: number
  estado: EstadoOcurrencia
  asistencia: {
    estado: EstadoAsistencia
    trabajado: string | null
    indicaciones: string | null
    observacion: string | null
  } | null
  plazoAsistencia: PlazoAsistencia | null
  temas: string | null
  alumno: { id: number; nombre: string; apellido: string; avatarKey: string | null }
  materia: { id: number; nombre: string }
  aula: { id: number; nombre: string }
}

/** Lo que se escribe en una ocurrencia: crea su `AsistenciaTurno` o la reemplaza. */
export type EscrituraAsistencia = {
  turnoId: number
  fecha: string
  estado: EstadoAsistencia
  trabajado: string | null
  indicaciones: string | null
  observacion: string | null
}

/** Qué ocurrencias leer: las del profesor en `[desde, hasta]`, opcionalmente de esos turnos. */
export type FiltroAsistencias = {
  profesorId: number
  desde: string
  hasta: string
  turnoIds?: number[]
}

/**
 * Ocurrencias del profesor (`leerOcurrencias` del motor, incluidas las canceladas) con los temas
 * del turno y la foto del alumno: dos consultas, sin importar cuántas sean.
 */
async function leer(
  client: ClienteOcurrencias,
  filtro: FiltroAsistencias,
  reloj?: Reloj,
): Promise<OcurrenciaDelProfesor[]> {
  const ocurrencias = await leerOcurrencias(client, filtro, reloj)
  if (ocurrencias.length === 0) return []

  const turnos = await client.turno.findMany({
    where: { id: { in: [...new Set(ocurrencias.map((o) => o.turnoId))] } },
    select: { id: true, temas: true, alumno: { select: { avatarKey: true } } },
  })
  const porId = new Map(turnos.map((t) => [t.id, t]))

  return ocurrencias.map((o) => {
    const turno = porId.get(o.turnoId)
    return {
      turnoId: o.turnoId,
      fecha: o.fecha,
      bloqueAgendaId: o.bloqueAgendaId,
      horaInicio: o.horaInicio,
      horaFin: o.horaFin,
      profesorId: o.profesorId,
      alumnoId: o.alumnoId,
      materiaId: o.materiaId,
      estado: o.estado,
      asistencia: o.asistencia && {
        estado: o.asistencia.estado,
        trabajado: o.asistencia.trabajado,
        indicaciones: o.asistencia.indicaciones,
        observacion: o.asistencia.observacion,
      },
      plazoAsistencia: o.plazoAsistencia,
      temas: turno?.temas ?? null,
      alumno: {
        id: o.alumno.id,
        nombre: o.alumno.nombre,
        apellido: o.alumno.apellido,
        avatarKey: turno?.alumno.avatarKey ?? null,
      },
      materia: o.materia,
      aula: o.aula,
    }
  })
}

export const asistenciasRepository = {
  /** Ocurrencias del profesor en el rango, **sin lock** (lecturas y chequeo previo del PUT). */
  leer(filtro: FiltroAsistencias, reloj?: Reloj): Promise<OcurrenciaDelProfesor[]> {
    return leer(prisma, filtro, reloj)
  },

  /** `ultimasIndicaciones` de `asistencias.condiciones.ts`, en una sola consulta. */
  ultimasIndicaciones(items: readonly ConsultaIndicaciones[]) {
    return ultimasIndicaciones(prisma, items)
  },

  /**
   * Registra o corrige asistencias de forma atómica (todo o nada), en una sola transacción:
   * 1. `bloquearAlumno` de cada alumno, ordenados por id, **antes de cualquier lectura**: serializa
   *    con una cancelación, una reprogramación o un pago de esas ocurrencias y con otro registro
   *    sobre ellas (el último gana). Los `alumnoIds` salen del chequeo previo: el alumno de un turno
   *    no cambia nunca.
   * 2. Relee las ocurrencias con el `tx`.
   * 3. `verificar(ocurrencias)`: si lanza, no se escribe nada.
   * 4. Un `upsert` por ocurrencia sobre el único `(turnoId, fechaOcurrencia)`: registrar crea la
   *    fila con el actor como creador y modificador; corregir la actualiza con el actor como
   *    modificador (`updatedAt` lo pone Prisma).
   * 5. Relee y devuelve las ocurrencias del filtro, ya con la asistencia escrita.
   */
  async registrar(
    entrada: { alumnoIds: number[]; filtro: FiltroAsistencias },
    verificar: (ocurrencias: OcurrenciaDelProfesor[]) => EscrituraAsistencia[],
    actor: Actor,
    reloj?: Reloj,
  ): Promise<OcurrenciaDelProfesor[]> {
    return prisma.$transaction(async (tx) => {
      for (const alumnoId of [...new Set(entrada.alumnoIds)].sort((a, b) => a - b)) {
        await bloquearAlumno(tx, alumnoId)
      }

      const escrituras = verificar(await leer(tx, entrada.filtro, reloj))

      for (const e of escrituras) {
        const datos = {
          estado: e.estado,
          trabajado: e.trabajado,
          indicaciones: e.indicaciones,
          observacion: e.observacion,
        }
        const fechaOcurrencia = fechaADate(e.fecha)
        await tx.asistenciaTurno.upsert({
          where: { turnoId_fechaOcurrencia: { turnoId: e.turnoId, fechaOcurrencia } },
          create: {
            turnoId: e.turnoId,
            fechaOcurrencia,
            ...datos,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          update: { ...datos, updatedById: actor.userId },
        })
      }

      return leer(tx, entrada.filtro, reloj)
    }, TRANSACCION_ASISTENCIA)
  },
}

export type AsistenciasRepository = typeof asistenciasRepository
