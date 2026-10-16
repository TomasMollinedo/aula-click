import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import {
  ultimoAdjuntoDeLiquidacion,
  vincularAdjuntoALiquidacion,
  type UltimoAdjunto,
} from '@/server/features/adjuntos/adjuntos.condiciones'
import {
  leerOcurrencias,
  type EstadoOcurrencia,
  type EstadoPagoOcurrencia,
  type PlazoAsistencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { fechaADate, type Reloj } from '@/server/shared/fechas'
import { primerDiaDelMes } from '@/server/shared/zod'
import {
  cierreDeLiquidacion,
  liquidacionDe,
  liquidacionesDelMes,
  liquidacionesDelProfesor,
  type Liquidacion,
  type ProfesorRef,
} from './liquidaciones.condiciones'
import {
  CODIGO_LIQUIDACION_MODIFICADA,
  CODIGO_LIQUIDACION_PAGADA,
  MENSAJE_LIQUIDACION_MODIFICADA,
  MENSAJE_SIN_IMPORTE,
  mensajeYaPagada,
} from './liquidaciones.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: el cálculo es del motor
// (`liquidaciones.condiciones.ts`, T-121), el adjunto, de `adjuntos.condiciones` (T-123), y las
// clases de "Mis ingresos", del motor de ocurrencias de `turnos` (`leerOcurrencias`, T-126).

// El recálculo del motor son varias consultas: el mismo margen que el pago de un alumno.
const TRANSACCION_PAGO = { timeout: 10_000 } as const

const aDecimal = (importe: number) => importe.toFixed(2)
const aCentavos = (importe: number) => Math.round(importe * 100)
const aMesDate = (mes: string) => fechaADate(primerDiaDelMes(mes))

/** Lo que el service le pasa a `pagar`, ya validado contra el mes y hoy. */
export type PagoDeLiquidacion = {
  profesor: ProfesorRef
  mes: string
  hoy: string
  fechaTransferencia: string
  numeroOperacion: string
  observaciones: string | null
  comprobanteAdjuntoId: number | null
  totalConfirmado: number
}

const errorModificada = (cause?: unknown) =>
  new ConflictError(MENSAJE_LIQUIDACION_MODIFICADA, { code: CODIGO_LIQUIDACION_MODIFICADA, cause })

/**
 * Una clase (una hora) del profesor con lo que necesita "Mis ingresos": la ocurrencia del motor
 * (horas en minutos), su estado, si tiene pago vigente y asistencia, y su plazo.
 */
export type ClaseLeida = {
  turnoId: number
  fecha: string
  horaInicio: number
  horaFin: number
  alumno: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
  estado: EstadoOcurrencia
  pago: EstadoPagoOcurrencia
  conAsistencia: boolean
  plazoAsistencia: PlazoAsistencia | null
}

export const liquidacionesRepository = {
  /**
   * Una liquidación por profesor con movimientos en `mes` (aunque esté inactivo), por apellido y
   * nombre; con `profesorId`, sólo la de ese profesor.
   */
  async delMes(filtro: { mes: string; profesorId?: number; hoy: string }): Promise<Liquidacion[]> {
    return liquidacionesDelMes(prisma, filtro)
  },

  /** La liquidación de `profesorId` en `mes` (cerrada o abierta), o `null` sin movimientos. */
  async deProfesor(datos: {
    profesorId: number
    mes: string
    hoy: string
  }): Promise<Liquidacion | null> {
    return liquidacionDe(prisma, datos)
  },

  /** Todas las liquidaciones de `profesorId` hasta el mes de `hoy`, una por mes con movimientos. */
  async todasDelProfesor(datos: { profesorId: number; hoy: string }): Promise<Liquidacion[]> {
    return liquidacionesDelProfesor(prisma, datos)
  },

  /**
   * Las clases de `profesorId` en `[desde, hasta]` (`leerOcurrencias`, incluidas las canceladas),
   * con el reloj del service, que decide el estado y el plazo de asistencia.
   */
  async clasesDelProfesor(
    filtro: { profesorId: number; desde: string; hasta: string },
    reloj?: Reloj,
  ): Promise<ClaseLeida[]> {
    const ocurrencias = await leerOcurrencias(prisma, filtro, reloj)
    return ocurrencias.map((o) => ({
      turnoId: o.turnoId,
      fecha: o.fecha,
      horaInicio: o.horaInicio,
      horaFin: o.horaFin,
      alumno: { id: o.alumno.id, nombre: o.alumno.nombre, apellido: o.alumno.apellido },
      materia: o.materia,
      estado: o.estado,
      pago: o.pago.estado,
      conAsistencia: o.asistencia !== null,
      plazoAsistencia: o.plazoAsistencia,
    }))
  },

  /** El id del profesor del usuario de la sesión, o `null` si no tiene ficha de profesor. */
  async profesorIdDeUsuario(usuarioId: string): Promise<number | null> {
    const fila = await prisma.profesor.findUnique({ where: { usuarioId }, select: { id: true } })
    return fila?.id ?? null
  },

  /** El profesor con su nombre, sin mirar su estado; `null` si no existe. */
  async leerProfesor(id: number): Promise<ProfesorRef | null> {
    const fila = await prisma.profesor.findUnique({
      where: { id },
      select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
    })
    return fila && { id: fila.id, nombre: fila.usuario.nombre, apellido: fila.usuario.apellido }
  },

  /** El comprobante de la transferencia de una liquidación cerrada, o `null`. */
  async ultimoAdjunto(liquidacionId: number): Promise<UltimoAdjunto | null> {
    return ultimoAdjuntoDeLiquidacion(prisma, liquidacionId)
  },

  /**
   * Paga la liquidación de `profesor` en `mes`, todo o nada, en una sola transacción:
   * 1. Recalcula con `cierreDeLiquidacion` (con el `tx`). Si no está `PENDIENTE_DE_PAGO`: 409
   *    `LIQUIDACION_PAGADA` si ya hay una `PAGADA`; si no, 409 `CONFLICTO` "No hay importe a pagar".
   * 2. Si el total no es el `totalConfirmado` (en centavos): 409 `LIQUIDACION_MODIFICADA`, sin
   *    escribir nada.
   * 3. Escribe las liquidaciones de la más nueva a la más vieja (la `PAGADA` primero, así cada
   *    `DESCONTADA` ya tiene el id de la que la absorbió), cada una con sus `LiquidacionTurno`; después
   *    todos los `AjusteLiquidacion`, y vincula el comprobante a la `PAGADA` (su 400
   *    `ADJUNTO_INVALIDO` deshace todo).
   * 4. Una P2002 de cualquier único (`liquidacion`, `liquidacion_turno.pago_turno_id` o los ajustes)
   *    es otro pago que ganó la carrera: 409 `LIQUIDACION_MODIFICADA`.
   *
   * Sin locks ni aislamiento mayor: una anulación que entre entre el recálculo y el commit deja el
   * turno en la cerrada y el motor la descuenta como ajuste en la siguiente (decisión T-163).
   */
  async pagar(
    pago: PagoDeLiquidacion,
    actor: Actor,
  ): Promise<{ liquidacionId: number; total: number }> {
    const { profesor, mes, hoy } = pago
    try {
      return await prisma.$transaction(async (tx) => {
        const cierre = await cierreDeLiquidacion(tx, { profesorId: profesor.id, mes, hoy })
        if (!cierre) {
          const cerrada = await tx.liquidacion.findUnique({
            where: { profesorId_mes: { profesorId: profesor.id, mes: aMesDate(mes) } },
            select: { estado: true },
          })
          if (cerrada?.estado === 'PAGADA') {
            throw new ConflictError(mensajeYaPagada(mes, profesor), {
              code: CODIGO_LIQUIDACION_PAGADA,
            })
          }
          throw new ConflictError(MENSAJE_SIN_IMPORTE)
        }
        const { total } = cierre.liquidacion
        if (aCentavos(total) !== aCentavos(pago.totalConfirmado)) throw errorModificada()

        const idPorMes = new Map<string, number>()
        for (const escritura of [...cierre.escrituras].reverse()) {
          const pagada = escritura.estado === 'PAGADA'
          const { id } = await tx.liquidacion.create({
            data: {
              profesorId: profesor.id,
              mes: aMesDate(escritura.mes),
              estado: escritura.estado,
              totalCobrado: aDecimal(escritura.totalCobrado),
              parteCentro: aDecimal(escritura.parteCentro),
              parteProfesor: aDecimal(escritura.parteProfesor),
              totalAjustes: aDecimal(escritura.totalAjustes),
              total: aDecimal(escritura.total),
              fechaTransferencia: pagada ? fechaADate(pago.fechaTransferencia) : null,
              numeroOperacion: pagada ? pago.numeroOperacion : null,
              observaciones: pagada ? pago.observaciones : null,
              descontadaEnId:
                escritura.descontadaEnMes === null
                  ? null
                  : idDe(idPorMes, escritura.descontadaEnMes),
              createdById: actor.userId,
              turnos: {
                createMany: {
                  data: escritura.turnos.map((turno) => ({
                    pagoTurnoId: turno.pagoTurnoId,
                    fechaDevengo: fechaADate(turno.fechaDevengo),
                    importe: aDecimal(turno.importe),
                    porcentajeCentro: aDecimal(turno.porcentaje),
                    parteProfesor: aDecimal(turno.parteProfesor),
                  })),
                },
              },
            },
            select: { id: true },
          })
          idPorMes.set(escritura.mes, id)
        }

        const ajustes = cierre.escrituras.flatMap((escritura) =>
          escritura.ajustes.map((ajuste) => ({
            liquidacionId: idDe(idPorMes, escritura.mes),
            tipo: ajuste.tipo,
            importe: aDecimal(ajuste.importe),
            ...(ajuste.tipo === 'ANULACION'
              ? { liquidacionTurnoId: ajuste.liquidacionTurnoId }
              : { liquidacionOrigenId: idDe(idPorMes, ajuste.mesOrigen) }),
          })),
        )
        if (ajustes.length > 0) await tx.ajusteLiquidacion.createMany({ data: ajustes })

        const liquidacionId = idDe(idPorMes, mes)
        if (pago.comprobanteAdjuntoId !== null) {
          await vincularAdjuntoALiquidacion(tx, {
            adjuntoId: pago.comprobanteAdjuntoId,
            liquidacionId,
            actor,
          })
        }
        return { liquidacionId, total }
      }, TRANSACCION_PAGO)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw errorModificada(error)
      }
      throw error
    }
  },
}

/** El id ya creado de la liquidación de `mes` en este cierre (el motor garantiza que está). */
function idDe(idPorMes: ReadonlyMap<string, number>, mes: string): number {
  const id = idPorMes.get(mes)
  if (id === undefined) throw new Error(`pagar: falta la liquidación ${mes} del cierre`)
  return id
}

export type LiquidacionesRepository = typeof liquidacionesRepository
