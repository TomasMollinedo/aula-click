import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import type { Actor } from '@/server/shared/actor'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import {
  bloquearParaReserva,
  claveOcupacion,
  leerSeries,
  ocupacionesEn,
  superposicionesDelAlumno,
} from './ocurrencias.condiciones'
import {
  contarVigentesPorBloques,
  contarVigentesPorMateria,
  listarVigentesPorProfesor,
  ocupacionMaximaPorFila,
} from './turnos.condiciones'
import type {
  EntradaReserva,
  FechasSinTurno,
  OcupacionMaximaPorFila,
  OcupacionPorBloque,
  PlanReserva,
  SnapshotReserva,
  TurnoDetalle,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from './turnos.validation'

// Único lugar de la feature que crea consultas con el cliente de Prisma. Sin reglas de negocio: las
// decide el service con `turnos.reglas.ts`. Las lecturas que otras features hacen dentro de su
// propia transacción viven en `turnos.condiciones.ts` (vigentes, ocupación máxima) y en el motor
// `ocurrencias.condiciones.ts` (ocurrencias, ocupación, superposición, locks); acá se usan con el
// cliente común o con el `tx` de la reserva.

/** Opciones de la transacción de `reservar` (ver el comentario ahí). */
const TRANSACCION_RESERVA = { timeout: 10_000 } as const

const SELECT_DETALLE = {
  id: true,
  tipo: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  observaciones: true,
  bloqueAgendaId: true,
  bloqueAgenda: {
    select: {
      diaSemana: true,
      horaInicio: true,
      horaFin: true,
      aula: { select: { id: true, nombre: true } },
      profesor: {
        select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
      },
    },
  },
  alumno: { select: { id: true, nombre: true, apellido: true, dni: true } },
  materia: { select: { id: true, nombre: true } },
  createdAt: true,
  updatedAt: true,
  createdBy: { select: SELECT_USUARIO_AUDITORIA },
  updatedBy: { select: SELECT_USUARIO_AUDITORIA },
} satisfies Prisma.TurnoSelect

type FilaDetalle = Prisma.TurnoGetPayload<{ select: typeof SELECT_DETALLE }>

function aDetalle(fila: FilaDetalle): TurnoDetalle {
  const { bloqueAgenda } = fila
  return {
    id: fila.id,
    tipo: fila.tipo,
    estado: fila.estado,
    fechaInicio: dateAFecha(fila.fechaInicio),
    fechaFin: fila.fechaFin && dateAFecha(fila.fechaFin),
    diaSemana: bloqueAgenda.diaSemana,
    horaInicio: minutosAHora(bloqueAgenda.horaInicio),
    horaFin: minutosAHora(bloqueAgenda.horaFin),
    bloqueId: fila.bloqueAgendaId,
    alumno: fila.alumno,
    profesor: {
      id: bloqueAgenda.profesor.id,
      nombre: bloqueAgenda.profesor.usuario.nombre,
      apellido: bloqueAgenda.profesor.usuario.apellido,
    },
    materia: fila.materia,
    aula: bloqueAgenda.aula,
    observaciones: fila.observaciones,
    ...armarAuditoria(fila),
  }
}

/**
 * Lee, con los locks ya tomados, todo lo que `planificarReserva` necesita. Lecturas simples (sin
 * lock propio) de materia y asignación: cubren una baja que confirmó antes que esta reserva.
 */
async function leerSnapshot(
  tx: Prisma.TransactionClient,
  entrada: EntradaReserva,
): Promise<SnapshotReserva> {
  const { alumnoId, profesorId, materiaId, bloqueIds, fechaInicio, fechaFin } = entrada
  const filas = await tx.bloqueAgenda.findMany({
    where: { id: { in: bloqueIds } },
    select: {
      id: true,
      estado: true,
      profesorId: true,
      diaSemana: true,
      horaInicio: true,
      horaFin: true,
      aula: { select: { capacidad: true } },
    },
  })
  const profesor = await tx.profesor.findUnique({
    where: { id: profesorId },
    select: { id: true, capacidad: true, usuario: { select: { estado: true } } },
  })
  const materia = await tx.materia.findUnique({
    where: { id: materiaId },
    select: { id: true, estado: true },
  })
  const asignacion = await tx.asignacionMateria.findUnique({
    where: { profesorId_materiaId: { profesorId, materiaId } },
    select: { estado: true },
  })
  // Series de las filas pedidas que se cruzan con el pedido, con su fin efectivo y sus fechas
  // canceladas: `analizarHora` decide qué fechas ocupan lugar.
  const ocupantes = await leerSeries(tx, {
    bloqueAgendaIds: bloqueIds,
    desde: fechaInicio,
    hasta: fechaFin,
  })
  // Turnos del alumno que chocan con el pedido (semanal desde `fechaInicio` hasta `fechaFin`) en
  // el día de las filas y en el rango de sus horas, de cualquier profesor. `planificarReserva` se
  // queda con los de alguna hora elegida (pueden no ser contiguas).
  const turnosAlumno =
    filas.length === 0
      ? []
      : await superposicionesDelAlumno(tx, {
          alumnoId,
          fecha: fechaInicio,
          hasta: fechaFin,
          horaInicio: Math.min(...filas.map((fila) => fila.horaInicio)),
          horaFin: Math.max(...filas.map((fila) => fila.horaFin)),
        })

  return {
    filas: filas.map(({ aula, ...fila }) => ({ ...fila, aulaCapacidad: aula.capacidad })),
    profesor: profesor && {
      id: profesor.id,
      capacidad: profesor.capacidad,
      estado: profesor.usuario.estado,
    },
    materia,
    asignacion,
    ocupantes: ocupantes.map((serie) => ({
      bloqueAgendaId: serie.bloqueAgendaId,
      estado: serie.estado,
      fechaInicio: serie.fechaInicio,
      finEfectivo: serie.finEfectivo,
      canceladas: serie.canceladas,
    })),
    turnosAlumno: turnosAlumno.map((ocurrencia) => ({
      id: ocurrencia.turnoId,
      tipo: ocurrencia.tipo,
      estado: 'ACTIVO' as const,
      fechaInicio: ocurrencia.serie.fechaInicio,
      fechaFin: ocurrencia.serie.fechaFin,
      diaSemana: ocurrencia.diaSemana,
      horaInicio: ocurrencia.horaInicio,
      horaFin: ocurrencia.horaFin,
      profesor: {
        id: ocurrencia.profesor.id,
        nombre: ocurrencia.profesor.nombre,
        apellido: ocurrencia.profesor.apellido,
      },
      materia: ocurrencia.materia,
    })),
  }
}

export const turnosRepository = {
  /**
   * Cantidad de turnos vigentes por materia, filtrable por profesor (el del bloque) y materias.
   * Solo vienen las materias con al menos un turno vigente.
   */
  async contarVigentesPorMateria(filtro: {
    fechaHoy: string
    profesorId?: number
    materiaIds?: number[]
  }): Promise<TurnosVigentesPorMateria[]> {
    return contarVigentesPorMateria(prisma, filtro)
  },

  /**
   * Cantidad de turnos vigentes de un bloque puntual. La usa `bloques` (T-17) para decidir
   * `TURNOS_VIGENTES` antes de editar o dar de baja una fila.
   */
  async contarVigentesPorBloque(bloqueAgendaId: number, fechaHoy: string): Promise<number> {
    const [grupo] = await contarVigentesPorBloques(prisma, [bloqueAgendaId], fechaHoy)
    return grupo?.cantidad ?? 0
  },

  /**
   * Turnos vigentes del profesor (de cualquiera de sus bloques), con los datos que HU-06 pide
   * mostrar antes de la baja: alumno, materia, tipo, fechas y horario. `fecha` es `fechaInicio`
   * (se conserva por compatibilidad); `fechaFin` es `null` en un recurrente sin fin. La usa
   * `profesores` para decidir `TURNOS_VIGENTES` antes de dar de baja. Ordenados por fecha y id.
   */
  async listarVigentesPorProfesor(
    profesorId: number,
    fechaHoy: string,
  ): Promise<TurnoVigentePorProfesor[]> {
    return listarVigentesPorProfesor(prisma, profesorId, fechaHoy)
  },

  /**
   * Ocupación simultánea máxima de cada hora activa del profesor desde hoy (la mayor cantidad de
   * turnos que ocupan lugar en una misma fecha). La usa `profesores` para decidir
   * `CAPACIDAD_INSUFICIENTE` antes de bajar la capacidad (T-15).
   */
  async ocupacionMaximaPorFila(
    profesorId: number,
    fechaHoy: string,
  ): Promise<OcupacionMaximaPorFila[]> {
    return ocupacionMaximaPorFila(prisma, profesorId, fechaHoy)
  },

  /**
   * Como `contarVigentesPorBloque`, pero para varias filas en una sola consulta. Solo vienen las
   * filas con al menos un turno vigente. La usa `bloques` para la baja de varias horas juntas.
   */
  async contarVigentesPorBloques(
    bloqueAgendaIds: number[],
    fechaHoy: string,
  ): Promise<TurnosVigentesPorBloque[]> {
    return contarVigentesPorBloques(prisma, bloqueAgendaIds, fechaHoy)
  },

  /**
   * Ocurrencias que ocupan lugar en cada par fila–fecha pedido, en **una sola consulta** (sin N+1):
   * delega en `ocupacionesEn` del motor (descuenta las canceladas y respeta el fin efectivo). Solo
   * vienen los pares con al menos una, sin repetir y en el orden pedido. La usan el horario de
   * `bloques` y la disponibilidad.
   */
  async contarOcupacionPorBloque(
    pares: { bloqueAgendaId: number; fecha: string }[],
  ): Promise<OcupacionPorBloque[]> {
    if (pares.length === 0) return []
    const ocupacion = await ocupacionesEn(prisma, pares)
    const vistos = new Set<string>()
    return pares.flatMap(({ bloqueAgendaId, fecha }) => {
      const clave = claveOcupacion(bloqueAgendaId, fecha)
      if (vistos.has(clave)) return []
      vistos.add(clave)
      const cantidad = ocupacion.get(clave) ?? 0
      return cantidad > 0 ? [{ bloqueAgendaId, fecha, cantidad }] : []
    })
  },

  /** Detalle de un turno (cualquier estado), o `null` si no existe. */
  async buscarDetalle(id: number): Promise<TurnoDetalle | null> {
    const fila = await prisma.turno.findUnique({ where: { id }, select: SELECT_DETALLE })
    return fila && aDetalle(fila)
  },

  /**
   * Registra una reserva de forma atómica: todo o nada, en una sola transacción. Las reglas las
   * decide `planificar` (un callback puro que pasa el service); acá solo se garantiza que decida
   * sobre datos que nadie puede cambiar hasta el `INSERT`.
   *
   * 1. Locks con `bloquearParaReserva` (el orden compartido por todas las escrituras sobre
   *    turnos: `profesor` `FOR SHARE`, las filas de `bloque_agenda` por id `FOR UPDATE` y
   *    `alumno` `FOR UPDATE`), antes de cualquier lectura.
   * 2. Relee todo con los locks tomados (`leerSnapshot`): las series de las filas con su fin
   *    efectivo y sus canceladas, y la superposición del alumno.
   * 3. `planificar(snapshot)`: si lanza, no se inserta nada.
   * 4. Inserta los turnos con la auditoría del actor y los devuelve con el select del detalle,
   *    ordenados por hora y fecha de inicio.
   */
  async reservar(
    entrada: EntradaReserva,
    planificar: (snapshot: SnapshotReserva) => PlanReserva,
    actor: Actor,
  ): Promise<{ turnos: TurnoDetalle[]; fechasSinTurno: FechasSinTurno[] }> {
    const { alumnoId, profesorId, bloqueIds } = entrada

    // Timeout más largo que el default de Prisma (5 s): con reservas simultáneas de la misma hora,
    // la espera del lock cuenta dentro de la transacción, y esa espera no tiene que terminar en 500.
    return prisma.$transaction(async (tx) => {
      await bloquearParaReserva(tx, { profesorId, bloqueAgendaIds: bloqueIds, alumnoId })

      const plan = planificar(await leerSnapshot(tx, entrada))

      const creados = await tx.turno.createManyAndReturn({
        data: plan.turnos.map((turno) => ({
          ...turno,
          fechaInicio: fechaADate(turno.fechaInicio),
          fechaFin: turno.fechaFin === null ? null : fechaADate(turno.fechaFin),
          createdById: actor.userId,
          updatedById: actor.userId,
        })),
        select: { id: true },
      })
      const filas = await tx.turno.findMany({
        where: { id: { in: creados.map((creado) => creado.id) } },
        select: SELECT_DETALLE,
        orderBy: [{ bloqueAgenda: { horaInicio: 'asc' } }, { fechaInicio: 'asc' }, { id: 'asc' }],
      })
      return { turnos: filas.map(aDetalle), fechasSinTurno: plan.fechasSinTurno }
    }, TRANSACCION_RESERVA)
  },
}

export type TurnosRepository = typeof turnosRepository
