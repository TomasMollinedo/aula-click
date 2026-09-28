import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import type { Actor } from '@/server/shared/actor'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { dateAFecha, diaSemanaISO, fechaADate } from '@/server/shared/fechas'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { minutosAHora } from '@/server/shared/zod'
import {
  condicionTurnoOcupaLugar,
  condicionTurnoSeCruzaCon,
  condicionTurnoVigente,
  contarVigentesPorBloques,
  contarVigentesPorMateria,
  listarVigentesPorProfesor,
  ocupacionMaximaPorFila,
} from './turnos.condiciones'
import { ocupaLugarEn } from './turnos.reglas'
import type {
  AgendaListado,
  AulasConTurnoListado,
  EntradaReserva,
  FechasSinTurno,
  MateriasConTurnoListado,
  OcupacionMaximaPorFila,
  OcupacionPorBloque,
  PlanReserva,
  SnapshotReserva,
  TurnoDeProfesor,
  TurnoDetalle,
  TurnoFechas,
  TurnosVigentesPorBloque,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from './turnos.validation'

// Único lugar de la feature que crea consultas con el cliente de Prisma. Sin reglas de negocio: las
// decide el service con `turnos.reglas.ts`. Las condiciones de consulta que otras features
// reutilizan (vigente, ocupa lugar, se cruza con) y las lecturas que hacen dentro de su propia
// transacción viven en `turnos.condiciones.ts`; acá se usan con el cliente común.

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

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Días de la semana (ISO) que toca el rango `[desde, hasta]`, o `undefined` si los toca a todos
 * (rango de una semana o más), para no filtrar de más. Recorre como mucho siete fechas.
 */
function diasDelRango(desde: string, hasta: string): number[] | undefined {
  const dias = new Set<number>()
  let fecha = desde
  while (fecha <= hasta && dias.size < 7) {
    dias.add(diaSemanaISO(fecha))
    fecha = dateAFecha(new Date(fechaADate(fecha).getTime() + MS_POR_DIA))
  }
  return dias.size >= 7 ? undefined : [...dias]
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
    return contarVigentesPorMateria(prisma, filtro)
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

  /**
   * Página de la agenda de una fecha: turnos que aplican ese día (`condicionTurnoOcupaLugar`) cuyo
   * bloque cae en el día de la semana correspondiente, excluyendo los `CANCELADO`. Filtrable por
   * materia, aula, profesor (vista personal de su agenda, decisión T-42) y `terminos` de búsqueda
   * (T-36: cada palabra tiene que coincidir en la `busqueda` del alumno, o todas en la del
   * `Usuario` del profesor, nunca mezcladas entre los dos; con `profesorId`, sólo busca por
   * alumno, porque el profesor ya está fijo). Ordenada por hora de inicio y, dentro de la hora,
   * por profesor (apellido y nombre, vía `busqueda` de su `Usuario`), y por `id` del turno si todo
   * lo anterior coincide.
   */
  async listarAgenda(filtro: {
    fecha: string
    page: number
    pageSize: number
    materiaId?: number
    aulaId?: number
    profesorId?: number
    terminos?: string[]
  }): Promise<AgendaListado> {
    const terminos = filtro.terminos ?? []
    const alumnoCoincide = {
      alumno: { AND: terminos.map((termino) => ({ busqueda: { contains: termino } })) },
    } satisfies Prisma.TurnoWhereInput
    const profesorCoincide = {
      bloqueAgenda: {
        profesor: {
          usuario: { AND: terminos.map((termino) => ({ busqueda: { contains: termino } })) },
        },
      },
    } satisfies Prisma.TurnoWhereInput
    // Con profesorId ya fijo, buscar también por nombre de profesor no aportaría nada.
    const busqueda =
      terminos.length === 0
        ? []
        : filtro.profesorId === undefined
          ? [{ OR: [alumnoCoincide, profesorCoincide] }]
          : [alumnoCoincide]

    // `condicionTurnoOcupaLugar` ya usa la clave `OR` (fechaFin nula o >= fecha): la búsqueda por
    // alumno/profesor no puede ir suelta en el mismo objeto (la pisaría). Van como ramas separadas
    // de un `AND` explícito. Combinada con el día de la semana del bloque, la condición incluye los
    // recurrentes cuyo rango contiene la fecha.
    const where = {
      AND: [
        condicionTurnoOcupaLugar(filtro.fecha),
        {
          bloqueAgenda: {
            diaSemana: diaSemanaISO(filtro.fecha),
            ...(filtro.aulaId === undefined ? {} : { aulaId: filtro.aulaId }),
            ...(filtro.profesorId === undefined ? {} : { profesorId: filtro.profesorId }),
          },
          ...(filtro.materiaId === undefined ? {} : { materiaId: filtro.materiaId }),
        },
        ...busqueda,
      ],
    } satisfies Prisma.TurnoWhereInput

    const [filas, total] = await prisma.$transaction([
      prisma.turno.findMany({
        where,
        select: {
          id: true,
          estado: true,
          alumno: { select: { id: true, apellido: true, nombre: true } },
          materia: { select: { id: true, nombre: true } },
          bloqueAgenda: {
            select: {
              horaInicio: true,
              horaFin: true,
              aula: { select: { id: true, nombre: true } },
              profesor: {
                select: { id: true, usuario: { select: { apellido: true, nombre: true } } },
              },
            },
          },
        },
        orderBy: [
          { bloqueAgenda: { horaInicio: 'asc' } },
          { bloqueAgenda: { profesor: { usuario: { busqueda: 'asc' } } } },
          { id: 'asc' },
        ],
        ...calcularSkipTake(filtro),
      }),
      prisma.turno.count({ where }),
    ])

    return {
      data: filas.map((fila) => ({
        id: fila.id,
        alumno: fila.alumno,
        profesor: {
          id: fila.bloqueAgenda.profesor.id,
          apellido: fila.bloqueAgenda.profesor.usuario.apellido,
          nombre: fila.bloqueAgenda.profesor.usuario.nombre,
        },
        materia: fila.materia,
        aula: fila.bloqueAgenda.aula,
        horaInicio: minutosAHora(fila.bloqueAgenda.horaInicio),
        horaFin: minutosAHora(fila.bloqueAgenda.horaFin),
        estado: fila.estado,
      })),
      meta: armarMeta(filtro, total),
    }
  },

  /**
   * Turnos de un profesor que se cruzan con `[desde, hasta]` (HU-10), **sin expandir**: el service
   * los convierte en ocurrencias con `expandirOcurrencias`, la misma condición "ocupa lugar" que
   * usa la agenda diaria, aplicada fecha por fecha. `condicionTurnoSeCruzaCon` ya excluye los
   * `CANCELADO`. Si el rango no llega a cubrir la semana, se acota además por los días que toca,
   * así un pedido de un solo día no lee los bloques de los otros días del profesor.
   *
   * Ordenados por hora de inicio y luego `id`: al expandir, las ocurrencias de cada fecha quedan
   * en ese mismo orden.
   *
   * A pesar del nombre, la usan la agenda propia (el profesor de la sesión) y la agenda de un
   * profesor para mesa de entradas (T-44): recibe el `profesorId` ya resuelto.
   */
  async listarAgendaPropia(filtro: {
    profesorId: number
    desde: string
    hasta: string
  }): Promise<TurnoDeProfesor[]> {
    const dias = diasDelRango(filtro.desde, filtro.hasta)
    const filas = await prisma.turno.findMany({
      where: {
        ...condicionTurnoSeCruzaCon(filtro.desde, filtro.hasta),
        bloqueAgenda: {
          profesorId: filtro.profesorId,
          ...(dias === undefined ? {} : { diaSemana: { in: dias } }),
        },
      },
      select: {
        id: true,
        tipo: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        alumno: { select: { id: true, apellido: true, nombre: true } },
        materia: { select: { id: true, nombre: true } },
        bloqueAgenda: {
          select: {
            diaSemana: true,
            horaInicio: true,
            horaFin: true,
            aula: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: [{ bloqueAgenda: { horaInicio: 'asc' } }, { id: 'asc' }],
    })

    return filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      ...aFechas(fila),
      diaSemana: fila.bloqueAgenda.diaSemana,
      horaInicio: minutosAHora(fila.bloqueAgenda.horaInicio),
      horaFin: minutosAHora(fila.bloqueAgenda.horaFin),
      alumno: fila.alumno,
      materia: fila.materia,
      aula: fila.bloqueAgenda.aula,
    }))
  },

  /**
   * Materias con al menos un turno que aplica esa fecha (`condicionTurnoOcupaLugar`, excluyendo los
   * `CANCELADO`), para el selector de materias de la agenda en el frontend. Ordenadas por nombre
   * (`busqueda`, sin tildes ni mayúsculas) y luego `id`. Sin paginar: es un selector de catálogo.
   *
   * A propósito **no filtra por `Materia.estado`**: importa si esa materia se dictó ese día, no si
   * hoy sigue activa. Con una fecha pasada, una materia dada de baja después sigue apareciendo si
   * tuvo un turno `ACTIVO` ese día (a diferencia de `materiasRepository.listarActivas()`, el
   * selector del catálogo vigente, que sí filtra por `estado`).
   */
  async listarMateriasConTurno(fecha: string): Promise<MateriasConTurnoListado> {
    return prisma.materia.findMany({
      where: {
        turnos: {
          some: {
            ...condicionTurnoOcupaLugar(fecha),
            bloqueAgenda: { diaSemana: diaSemanaISO(fecha) },
          },
        },
      },
      select: { id: true, nombre: true },
      orderBy: [{ busqueda: 'asc' }, { id: 'asc' }],
    })
  },

  /**
   * Aulas con al menos un bloque que ese día de la semana tiene un turno que aplica esa fecha
   * (`condicionTurnoOcupaLugar`, excluyendo los `CANCELADO`), para el selector de aula de la agenda
   * en el frontend. Ordenadas por nombre y luego `id`, como `aulasRepository.listar()`. Sin
   * paginar: es un selector de catálogo.
   *
   * A propósito **no filtra por `Aula.estado`**: importa si se usó ese día, no si hoy sigue
   * activa. Con una fecha pasada, un aula dada de baja después sigue apareciendo si tuvo un turno
   * `ACTIVO` ese día.
   */
  async listarAulasConTurno(fecha: string): Promise<AulasConTurnoListado> {
    return prisma.aula.findMany({
      where: {
        bloques: {
          some: {
            diaSemana: diaSemanaISO(fecha),
            turnos: { some: condicionTurnoOcupaLugar(fecha) },
          },
        },
      },
      select: { id: true, nombre: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    })
  },
}

export type TurnosRepository = typeof turnosRepository
