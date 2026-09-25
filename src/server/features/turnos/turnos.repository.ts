import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import type { Actor } from '@/server/shared/actor'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import { ocupaLugarEn } from './turnos.reglas'
import type {
  EntradaReserva,
  FechasSinTurno,
  OcupacionPorBloque,
  PlanReserva,
  SnapshotReserva,
  TurnoDetalle,
  TurnoFechas,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from './turnos.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: las decide el service con
// `turnos.reglas.ts`. Lo que vive acá son las condiciones de consulta que otras features
// reutilizan (vigente, ocupa lugar, se cruza con) y la atomicidad de la reserva.

/**
 * Condición de **turno vigente** (docs/dominio.md → Turnos): `fechaFin` nula (recurrente sin fin)
 * o >= hoy, y estado `ACTIVO`. Un turno `CANCELADO` no cuenta: la vigencia se decide por fecha,
 * pero un cancelado no bloquea nada.
 *
 * Es la **única** implementación de la condición (convenciones-backend.md → Turno vigente): se
 * reutiliza desde acá, nunca se reescribe en otra feature. `fechaHoy` la calcula el service con
 * `hoy()` y su reloj inyectable.
 */
export function condicionTurnoVigente(fechaHoy: string) {
  return {
    estado: 'ACTIVO',
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(fechaHoy) } }],
  } satisfies Prisma.TurnoWhereInput
}

/**
 * Turno `ACTIVO` con al menos una fecha en `[inicio, fin]` (`fin` `null` = sin fin): `fechaInicio
 * <= fin` y `fechaFin` nula o `>= inicio`. Es la lectura de "los turnos que pueden chocar con un
 * pedido" (reserva) y la base de `condicionTurnoOcupaLugar`. Equivale al predicado puro
 * `seCruzaCon` de `turnos.reglas.ts`. Se combina con el `bloqueAgendaId` o el `alumnoId`.
 *
 * Ojo al combinarla: tiene un `OR` (y puede tener `fechaInicio`) en el primer nivel. Se puede
 * mezclar por spread con otras claves (`bloqueAgendaId`, `alumnoId`, un `OR` anidado en una
 * relación), pero no con otra condición que también tenga `OR` o `fechaInicio` en el primer nivel
 * (como `condicionTurnoVigente`): el spread pisaría uno con otro. En ese caso, `AND: [a, b]`.
 */
export function condicionTurnoSeCruzaCon(inicio: string, fin: string | null) {
  return {
    estado: 'ACTIVO',
    ...(fin === null ? {} : { fechaInicio: { lte: fechaADate(fin) } }),
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(inicio) } }],
  } satisfies Prisma.TurnoWhereInput
}

/**
 * Condición de **turno que ocupa lugar** en una fila de `bloque_agenda` en `fecha` (una sola para
 * los dos tipos): `ACTIVO`, `fechaInicio <= fecha` y `fechaFin` nula o `>= fecha`. Una sesión
 * única es el caso `fechaInicio = fechaFin`; un recurrente ocupa lugar en cada fecha de su rango
 * (todas caen en el día de su fila). Es la ocupación del horario (T-33) y del control de
 * capacidad (`BLOQUE_LLENO`): se reutiliza desde acá, nunca se reescribe. Equivale al predicado
 * puro `ocupaLugarEn` de `turnos.reglas.ts`. Se combina con el `bloqueAgendaId` de la fila.
 */
export function condicionTurnoOcupaLugar(fecha: string) {
  return condicionTurnoSeCruzaCon(fecha, fecha)
}

/** Opciones de la transacción de `reservar` (ver el comentario ahí). */
const TRANSACCION_RESERVA = { timeout: 10_000 } as const

const SELECT_FECHAS = { estado: true, fechaInicio: true, fechaFin: true } as const

function aFechas(fila: {
  estado: TurnoFechas['estado']
  fechaInicio: Date
  fechaFin: Date | null
}): TurnoFechas {
  return {
    estado: fila.estado,
    fechaInicio: dateAFecha(fila.fechaInicio),
    fechaFin: fila.fechaFin && dateAFecha(fila.fechaFin),
  }
}

const SELECT_DETALLE = {
  id: true,
  tipo: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  motivoConsulta: true,
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
    motivoConsulta: fila.motivoConsulta,
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
  const cruzaConPedido = condicionTurnoSeCruzaCon(fechaInicio, fechaFin)

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
  const ocupantes = await tx.turno.findMany({
    where: { ...cruzaConPedido, bloqueAgendaId: { in: bloqueIds } },
    select: { bloqueAgendaId: true, ...SELECT_FECHAS },
  })
  // Mismo día y hora que alguna fila pedida (cada fila es una hora en punto: pisarse es igualdad),
  // de cualquier profesor.
  const turnosAlumno =
    filas.length === 0
      ? []
      : await tx.turno.findMany({
          where: {
            ...cruzaConPedido,
            alumnoId,
            bloqueAgenda: {
              OR: filas.map((fila) => ({ diaSemana: fila.diaSemana, horaInicio: fila.horaInicio })),
            },
          },
          select: {
            id: true,
            tipo: true,
            ...SELECT_FECHAS,
            bloqueAgenda: {
              select: {
                diaSemana: true,
                horaInicio: true,
                horaFin: true,
                profesor: {
                  select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
                },
              },
            },
            materia: { select: { id: true, nombre: true } },
          },
          orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
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
    ocupantes: ocupantes.map((turno) => ({
      bloqueAgendaId: turno.bloqueAgendaId,
      ...aFechas(turno),
    })),
    turnosAlumno: turnosAlumno.map((turno) => ({
      id: turno.id,
      tipo: turno.tipo,
      ...aFechas(turno),
      diaSemana: turno.bloqueAgenda.diaSemana,
      horaInicio: turno.bloqueAgenda.horaInicio,
      horaFin: turno.bloqueAgenda.horaFin,
      profesor: {
        id: turno.bloqueAgenda.profesor.id,
        nombre: turno.bloqueAgenda.profesor.usuario.nombre,
        apellido: turno.bloqueAgenda.profesor.usuario.apellido,
      },
      materia: turno.materia,
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
    const grupos = await prisma.turno.groupBy({
      by: ['materiaId'],
      where: {
        ...condicionTurnoVigente(filtro.fechaHoy),
        ...(filtro.profesorId === undefined
          ? {}
          : { bloqueAgenda: { profesorId: filtro.profesorId } }),
        ...(filtro.materiaIds === undefined ? {} : { materiaId: { in: filtro.materiaIds } }),
      },
      _count: { _all: true },
      orderBy: { materiaId: 'asc' },
    })
    return grupos.map((grupo) => ({ materiaId: grupo.materiaId, cantidad: grupo._count._all }))
  },

  /**
   * Cantidad de turnos vigentes de un bloque puntual. La usa `bloques` (T-17) para decidir
   * `TURNOS_VIGENTES` antes de editar o dar de baja una fila.
   */
  async contarVigentesPorBloque(bloqueAgendaId: number, fechaHoy: string): Promise<number> {
    return prisma.turno.count({
      where: { ...condicionTurnoVigente(fechaHoy), bloqueAgendaId },
    })
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
    const filas = await prisma.turno.findMany({
      where: { ...condicionTurnoVigente(fechaHoy), bloqueAgenda: { profesorId } },
      select: {
        alumno: { select: { id: true, nombre: true, apellido: true } },
        materia: { select: { id: true, nombre: true } },
        tipo: true,
        fechaInicio: true,
        fechaFin: true,
        bloqueAgenda: { select: { horaInicio: true, horaFin: true } },
      },
      orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
    })
    return filas.map((fila) => ({
      alumno: fila.alumno,
      materia: fila.materia,
      tipo: fila.tipo,
      fecha: dateAFecha(fila.fechaInicio),
      fechaFin: fila.fechaFin && dateAFecha(fila.fechaFin),
      horaInicio: minutosAHora(fila.bloqueAgenda.horaInicio),
      horaFin: minutosAHora(fila.bloqueAgenda.horaFin),
    }))
  },

  /**
   * Como `contarVigentesPorBloque`, pero para varias filas en una sola consulta. Solo vienen las
   * filas con al menos un turno vigente. La usa `bloques` para la baja de varias horas juntas.
   */
  async contarVigentesPorBloques(
    bloqueAgendaIds: number[],
    fechaHoy: string,
  ): Promise<TurnosVigentesPorBloque[]> {
    const grupos = await prisma.turno.groupBy({
      by: ['bloqueAgendaId'],
      where: { ...condicionTurnoVigente(fechaHoy), bloqueAgendaId: { in: bloqueAgendaIds } },
      _count: { _all: true },
      orderBy: { bloqueAgendaId: 'asc' },
    })
    return grupos.map((grupo) => ({
      bloqueAgendaId: grupo.bloqueAgendaId,
      cantidad: grupo._count._all,
    }))
  },

  /**
   * Turnos que ocupan lugar en cada par fila–fecha pedido, en **una sola consulta** (sin N+1):
   * trae los turnos `ACTIVO` de esas filas que se cruzan con `[min(fechas), max(fechas)]` y cuenta
   * en memoria, con `ocupaLugarEn`, cuántos ocupan lugar en cada par (un recurrente cuenta en
   * todas las fechas de su rango). Solo vienen los pares con al menos un turno.
   */
  async contarOcupacionPorBloque(
    pares: { bloqueAgendaId: number; fecha: string }[],
  ): Promise<OcupacionPorBloque[]> {
    if (pares.length === 0) return []
    const fechas = pares.map((par) => par.fecha).sort()
    const desde = fechas[0] ?? ''
    const hasta = fechas.at(-1) ?? desde

    const filas = await prisma.turno.findMany({
      where: {
        ...condicionTurnoSeCruzaCon(desde, hasta),
        bloqueAgendaId: { in: [...new Set(pares.map((par) => par.bloqueAgendaId))] },
      },
      select: { bloqueAgendaId: true, ...SELECT_FECHAS },
    })
    const porFila = new Map<number, TurnoFechas[]>()
    for (const fila of filas) {
      porFila.set(fila.bloqueAgendaId, [...(porFila.get(fila.bloqueAgendaId) ?? []), aFechas(fila)])
    }

    const vistos = new Set<string>()
    return pares.flatMap(({ bloqueAgendaId, fecha }) => {
      const clave = `${bloqueAgendaId}|${fecha}`
      if (vistos.has(clave)) return []
      vistos.add(clave)
      const cantidad = (porFila.get(bloqueAgendaId) ?? []).filter((turno) =>
        ocupaLugarEn(turno, fecha),
      ).length
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
   * 1. Locks, siempre en este orden (el de `bloques`, que bloquea `profesor` y después escribe
   *    `bloque_agenda`), para no generar deadlocks:
   *    - `profesor` `FOR SHARE`: dos reservas del mismo profesor no se esperan acá, pero un alta
   *      o edición de bloques del profesor (que lo toma `FOR UPDATE`) sí;
   *    - las filas de `bloque_agenda`, ordenadas por id, `FOR UPDATE`: serializan la capacidad
   *      de cada hora;
   *    - `alumno` `FOR UPDATE`: serializa `ALUMNO_SUPERPUESTO` entre reservas del mismo alumno
   *      con profesores distintos.
   * 2. Relee todo con los locks tomados (`leerSnapshot`).
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
      await tx.$queryRaw(Prisma.sql`SELECT id FROM profesor WHERE id = ${profesorId} FOR SHARE`)
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM bloque_agenda WHERE id IN (${Prisma.join(bloqueIds)}) ORDER BY id FOR UPDATE`,
      )
      await tx.$queryRaw(Prisma.sql`SELECT id FROM alumno WHERE id = ${alumnoId} FOR UPDATE`)

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
