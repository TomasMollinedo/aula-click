import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { UltimoAdjunto } from '@/server/features/adjuntos/adjuntos.condiciones'
import type { Actor } from '@/server/shared/actor'
import { hoy, sumarDias, type Reloj } from '@/server/shared/fechas'
import { fechaDocumento } from '@/server/shared/formato'
import { armarMeta, calcularSkipTake } from '@/server/shared/paginacion'
import { mesAnterior, mesDe, minutosAHora, ultimoDiaDelMes } from '@/server/shared/zod'
import type { Liquidacion, ProfesorRef } from './liquidaciones.condiciones'
import { documentoDeLiquidacion, type LiquidacionDocumento } from './liquidaciones.documentos'
import type { ClaseLeida, LiquidacionesRepository } from './liquidaciones.repository'
import {
  MENSAJE_MES_FUTURO,
  MENSAJE_TRANSFERENCIA_FUTURA,
  mensajeMesNoTerminado,
  type ClaseCobradaSinAsistencia,
  type ClaseDelProfesor,
  type FilaLiquidacion,
  type FilaMiLiquidacion,
  type LiquidacionDetalle,
  type LiquidacionPagada,
  type LiquidacionesDelMes,
  type LiquidacionesQuery,
  type LiquidacionParams,
  type MiLiquidacion,
  type MiLiquidacionParams,
  type MisIngresos,
  type MisLiquidaciones,
  type MisLiquidacionesQuery,
  type PagarLiquidacion,
  type TotalesLiquidacion,
} from './liquidaciones.validation'

// Liquidaciones del gerente (HU-44, T-124): el listado del mes, el detalle y el pago; y "Mis
// ingresos" del profesor (HU-45, T-126): su mes en curso, sus clases sin cobrar o sin asistencia y sus
// liquidaciones. No conoce HTTP ni Prisma: lanza AppError o sus subclases. No calcula importes: todo
// sale de la `Liquidacion` del motor (`liquidaciones.condiciones.ts`), que congela las cerradas
// (decisión T-156), y el estado de cada clase, del motor de ocurrencias.

/** Cuántos días para atrás mira "clases sin cobrar": el tope de los otros listados (366 días). */
const DIAS_CLASES_SIN_COBRAR = 366

/** El plazo de asistencia es de 7 días: una clase anterior ya no puede estar dentro del plazo. */
const DIAS_PLAZO_ASISTENCIA = 7

const aCentavos = (importe: number) => Math.round(importe * 100)

function totalesDe(liquidacion: Liquidacion): TotalesLiquidacion {
  return {
    cantidadTurnos: liquidacion.turnos.length,
    totalCobrado: liquidacion.totalCobrado,
    parteCentro: liquidacion.parteCentro,
    parteProfesor: liquidacion.parteProfesor,
    totalAjustes: liquidacion.totalAjustes,
    total: liquidacion.total,
  }
}

/** Suma de cada columna, en centavos enteros (convenciones-backend.md → Importes). */
function sumarTotales(filas: readonly TotalesLiquidacion[]): TotalesLiquidacion {
  const suma = (columna: keyof Omit<TotalesLiquidacion, 'cantidadTurnos'>) =>
    filas.reduce((total, fila) => total + aCentavos(fila[columna]), 0) / 100
  return {
    cantidadTurnos: filas.reduce((total, fila) => total + fila.cantidadTurnos, 0),
    totalCobrado: suma('totalCobrado'),
    parteCentro: suma('parteCentro'),
    parteProfesor: suma('parteProfesor'),
    totalAjustes: suma('totalAjustes'),
    total: suma('total'),
  }
}

/** Lo que hay que transferir: la suma de los totales mayores a 0, en centavos. */
function sumarAPagar(filas: readonly TotalesLiquidacion[]): number {
  return filas.reduce((suma, fila) => suma + Math.max(aCentavos(fila.total), 0), 0) / 100
}

function aFila(liquidacion: Liquidacion): FilaLiquidacion {
  return {
    profesor: liquidacion.profesor,
    estado: liquidacion.estado,
    ...totalesDe(liquidacion),
    fechaTransferencia:
      liquidacion.estado === 'PAGADA' ? (liquidacion.cerrada?.fechaTransferencia ?? null) : null,
    descontadaEnMes:
      liquidacion.estado === 'DESCONTADA' ? (liquidacion.cerrada?.descontadaEnMes ?? null) : null,
  }
}

function aRespuestaDetalle(
  liquidacion: Liquidacion,
  adjunto: UltimoAdjunto | null,
): LiquidacionDetalle {
  const { cerrada } = liquidacion
  return {
    profesor: liquidacion.profesor,
    mes: liquidacion.mes,
    estado: liquidacion.estado,
    turnos: liquidacion.turnos.map((turno) => ({
      fecha: turno.fecha,
      horaInicio: minutosAHora(turno.horaInicio),
      horaFin: minutosAHora(turno.horaFin),
      alumno: turno.alumno,
      materia: turno.materia,
      numeroComprobante: turno.numeroComprobante,
      importe: turno.importe,
      porcentaje: turno.porcentaje,
      parteProfesor: turno.parteProfesor,
    })),
    ajustes: liquidacion.ajustes.map(({ tipo, texto, importe }) => ({ tipo, texto, importe })),
    ...totalesDe(liquidacion),
    cerrada: cerrada && {
      liquidacionId: cerrada.id,
      fechaTransferencia: cerrada.fechaTransferencia,
      numeroOperacion: cerrada.numeroOperacion,
      observaciones: cerrada.observaciones,
      descontadaEnMes: cerrada.descontadaEnMes,
      comprobanteAdjunto: adjunto && {
        id: adjunto.id,
        nombre: adjunto.nombre,
        tipo: adjunto.tipo,
        bytes: adjunto.bytes,
        adjuntadoPor: adjunto.adjuntadoPor,
        adjuntadoEl: adjunto.adjuntadoEl,
      },
      registradaPor: cerrada.registradaPor,
      registradaEl: cerrada.registradaEl,
    },
    // El motor ya garantiza mes terminado y total > 0 en `PENDIENTE_DE_PAGO`.
    acciones: { registrarPago: liquidacion.estado === 'PENDIENTE_DE_PAGO' },
  }
}

/** La liquidación de un profesor sin movimientos en el mes. */
function detalleVacio(profesor: ProfesorRef, mes: string): LiquidacionDetalle {
  return {
    profesor,
    mes,
    estado: null,
    turnos: [],
    ajustes: [],
    ...sumarTotales([]),
    cerrada: null,
    acciones: { registrarPago: false },
  }
}

/**
 * La liquidación del profesor ("Mis ingresos"): la del gerente sin lo que no es suyo (decisiones
 * de T-126): ni el número de comprobante de las familias, ni el adjunto, ni quién registró el pago,
 * ni las observaciones, ni las acciones. Los totales son los de su liquidación, no los del centro.
 */
function aMiLiquidacion(liquidacion: Liquidacion): MiLiquidacion {
  const { cerrada } = liquidacion
  return {
    mes: liquidacion.mes,
    estado: liquidacion.estado,
    turnos: liquidacion.turnos.map((turno) => ({
      fecha: turno.fecha,
      horaInicio: minutosAHora(turno.horaInicio),
      horaFin: minutosAHora(turno.horaFin),
      alumno: turno.alumno,
      materia: turno.materia,
      importe: turno.importe,
      porcentaje: turno.porcentaje,
      parteProfesor: turno.parteProfesor,
    })),
    ajustes: liquidacion.ajustes.map(({ tipo, texto, importe }) => ({ tipo, texto, importe })),
    ...totalesDe(liquidacion),
    cerrada: cerrada && {
      liquidacionId: cerrada.id,
      fechaTransferencia: cerrada.fechaTransferencia,
      numeroOperacion: cerrada.numeroOperacion,
      descontadaEnMes: cerrada.descontadaEnMes,
    },
  }
}

/** La liquidación del profesor en un mes sin movimientos. */
function miLiquidacionVacia(mes: string): MiLiquidacion {
  return { mes, estado: null, turnos: [], ajustes: [], ...sumarTotales([]), cerrada: null }
}

function aClase(clase: ClaseLeida): ClaseDelProfesor {
  return {
    turnoId: clase.turnoId,
    fecha: clase.fecha,
    horaInicio: minutosAHora(clase.horaInicio),
    horaFin: minutosAHora(clase.horaFin),
    alumno: clase.alumno,
    materia: clase.materia,
  }
}

/**
 * Clase sin cobrar: con asistencia (`REALIZADO` es presente; `AUSENTE`, ausente) y sin pago
 * vigente. Una cancelada no cuenta aunque tenga asistencia.
 */
function esSinCobrar(clase: ClaseLeida): boolean {
  return (clase.estado === 'REALIZADO' || clase.estado === 'AUSENTE') && clase.pago === 'PENDIENTE'
}

/**
 * Clase cobrada sin asistencia: con pago vigente, sin asistencia, no cancelada y dentro del plazo
 * para registrarla (`plazoAsistencia` del motor, también una de hoy, que todavía es `AGENDADO`).
 */
function esCobradaSinAsistencia(
  clase: ClaseLeida,
): clase is ClaseLeida & { plazoAsistencia: { vence: string; vencido: false } } {
  return (
    clase.pago === 'PAGADO' &&
    !clase.conAsistencia &&
    clase.estado !== 'CANCELADO' &&
    clase.plazoAsistencia !== null &&
    !clase.plazoAsistencia.vencido
  )
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Lo importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearLiquidacionesService({
  repository,
  reloj,
}: {
  repository: Pick<
    LiquidacionesRepository,
    | 'delMes'
    | 'deProfesor'
    | 'leerProfesor'
    | 'ultimoAdjunto'
    | 'pagar'
    | 'profesorIdDeUsuario'
    | 'todasDelProfesor'
    | 'clasesDelProfesor'
  >
  reloj?: Reloj
}) {
  /**
   * El profesor de la sesión: sale del `Actor`, nunca de un parámetro (como `mis-alumnos`). Un
   * usuario sin ficha de profesor → 403 (lo pide T-126).
   */
  async function profesorDeLaSesion(actor: Actor): Promise<number> {
    const profesorId = await repository.profesorIdDeUsuario(actor.userId)
    if (profesorId === null) throw new ForbiddenError('No tenés permiso para esta operación')
    return profesorId
  }

  /** 400 en `mes` si es posterior al mes de `fechaHoy`. El mes en curso se puede pedir. */
  function exigirMesNoFuturo(mes: string, fechaHoy: string): void {
    if (mes > mesDe(fechaHoy)) {
      throw new ValidationError('Datos de entrada inválidos', {
        details: [{ path: ['mes'], message: MENSAJE_MES_FUTURO }],
      })
    }
  }

  /** 400 en `fechaTransferencia` si es futura o anterior al último día del mes liquidado. */
  function exigirFechaTransferencia(fecha: string, mes: string, fechaHoy: string): void {
    const ultimoDia = ultimoDiaDelMes(mes)
    const mensaje =
      fecha > fechaHoy
        ? MENSAJE_TRANSFERENCIA_FUTURA
        : fecha < ultimoDia
          ? `La transferencia no puede ser anterior al ${fechaDocumento(ultimoDia)}`
          : null
    if (mensaje) {
      throw new ValidationError('Datos de entrada inválidos', {
        details: [{ path: ['fechaTransferencia'], message: mensaje }],
      })
    }
  }

  /**
   * El documento PDF de la liquidación, con el permiso ya resuelto: 400 si el mes es futuro, 404 si
   * el profesor no existe. El número de comprobante sólo va en el del gerente (decisión T-171).
   */
  async function armarDocumento(
    { profesorId, mes }: LiquidacionParams,
    actor: Actor,
  ): Promise<LiquidacionDocumento> {
    const fechaHoy = hoy(reloj)
    exigirMesNoFuturo(mes, fechaHoy)
    const [profesor, liquidacion] = await Promise.all([
      repository.leerProfesor(profesorId),
      repository.deProfesor({ profesorId, mes, hoy: fechaHoy }),
    ])
    if (!profesor) throw new NotFoundError('Profesor no encontrado')
    return documentoDeLiquidacion(profesor, mes, liquidacion, {
      conComprobante: actor.role === 'GERENTE',
    })
  }

  async function exigirProfesor(profesorId: number): Promise<ProfesorRef> {
    const profesor = await repository.leerProfesor(profesorId)
    if (!profesor) throw new NotFoundError('Profesor no encontrado')
    return profesor
  }

  return {
    /**
     * Las liquidaciones del mes (por defecto, el último terminado), una por profesor con
     * movimientos, que se pueden filtrar por profesor y por estado, paginadas en memoria;
     * `totales` es de todo el listado filtrado.
     */
    async listar(query: LiquidacionesQuery): Promise<LiquidacionesDelMes> {
      const fechaHoy = hoy(reloj)
      const mes = query.mes ?? mesAnterior(mesDe(fechaHoy))
      exigirMesNoFuturo(mes, fechaHoy)
      const delMes = (
        await repository.delMes({ mes, profesorId: query.profesorId, hoy: fechaHoy })
      ).map(aFila)
      // El estado se filtra antes de paginar y de sumar: el total y las páginas son los del filtro.
      const filas = query.estado ? delMes.filter((fila) => fila.estado === query.estado) : delMes
      const { skip, take } = calcularSkipTake(query)
      return {
        mes,
        totales: { ...sumarTotales(filas), totalAPagar: sumarAPagar(filas) },
        data: filas.slice(skip, skip + take),
        meta: armarMeta(query, filas.length),
      }
    },

    /**
     * La liquidación de un profesor en un mes: la cerrada (congelada, con su comprobante) o la
     * abierta. Profesor inexistente → 404; sin movimientos → la liquidación vacía.
     */
    async detalle({ profesorId, mes }: LiquidacionParams): Promise<LiquidacionDetalle> {
      const fechaHoy = hoy(reloj)
      exigirMesNoFuturo(mes, fechaHoy)
      const [profesor, liquidacion] = await Promise.all([
        repository.leerProfesor(profesorId),
        repository.deProfesor({ profesorId, mes, hoy: fechaHoy }),
      ])
      if (!profesor) throw new NotFoundError('Profesor no encontrado')
      if (!liquidacion) return detalleVacio(profesor, mes)
      const adjunto =
        liquidacion.cerrada && liquidacion.estado === 'PAGADA'
          ? await repository.ultimoAdjunto(liquidacion.cerrada.id)
          : null
      return aRespuestaDetalle(liquidacion, adjunto)
    },

    /**
     * Registra la transferencia de una liquidación `PENDIENTE_DE_PAGO` por su total calculado. Orden
     * de errores: 404 del profesor; 409 si el mes no terminó; 400 de `fechaTransferencia`; después,
     * los 409 de la transacción (`pagar`: ya pagada, sin importe o total modificado).
     */
    async pagar(
      { profesorId, mes }: LiquidacionParams,
      datos: PagarLiquidacion,
      actor: Actor,
    ): Promise<LiquidacionPagada> {
      const fechaHoy = hoy(reloj)
      const profesor = await exigirProfesor(profesorId)
      if (mes >= mesDe(fechaHoy)) throw new ConflictError(mensajeMesNoTerminado(mes))
      exigirFechaTransferencia(datos.fechaTransferencia, mes, fechaHoy)
      const { liquidacionId, total } = await repository.pagar(
        {
          profesor,
          mes,
          hoy: fechaHoy,
          fechaTransferencia: datos.fechaTransferencia,
          numeroOperacion: datos.numeroOperacion,
          observaciones: datos.observaciones ?? null,
          comprobanteAdjuntoId: datos.comprobanteAdjuntoId ?? null,
          totalConfirmado: datos.totalConfirmado,
        },
        actor,
      )
      return { liquidacionId, profesor, mes, total, fechaTransferencia: datos.fechaTransferencia }
    },

    // ---------- "Mis ingresos" del profesor (HU-45, T-126) ----------

    /**
     * El mes en curso del profesor de la sesión (el mismo cálculo que ve el gerente), sus clases sin
     * cobrar de los últimos 366 días y las cobradas sin asistencia dentro del plazo, de la más
     * reciente a la más antigua. Una sola lectura de ocurrencias para las dos listas.
     */
    async misIngresos(actor: Actor): Promise<MisIngresos> {
      const fechaHoy = hoy(reloj)
      const profesorId = await profesorDeLaSesion(actor)
      const mes = mesDe(fechaHoy)
      const [liquidacion, clases] = await Promise.all([
        repository.deProfesor({ profesorId, mes, hoy: fechaHoy }),
        repository.clasesDelProfesor(
          {
            profesorId,
            desde: sumarDias(fechaHoy, -(DIAS_CLASES_SIN_COBRAR - 1)),
            hasta: fechaHoy,
          },
          reloj,
        ),
      ])
      // El motor las ordena de la más antigua a la más reciente.
      const recientesPrimero = [...clases].reverse()
      const desdePlazo = sumarDias(fechaHoy, -DIAS_PLAZO_ASISTENCIA)
      return {
        esteMes: liquidacion ? aMiLiquidacion(liquidacion) : miLiquidacionVacia(mes),
        clasesSinCobrar: recientesPrimero.filter(esSinCobrar).map(aClase),
        clasesCobradasSinAsistencia: recientesPrimero
          .filter((clase) => clase.fecha >= desdePlazo)
          .filter(esCobradaSinAsistencia)
          .map((clase): ClaseCobradaSinAsistencia => ({
            ...aClase(clase),
            vence: clase.plazoAsistencia.vence,
          })),
      }
    },

    /**
     * Las liquidaciones del profesor de la sesión, una fila por mes con movimientos, sin el mes en
     * curso (está en `misIngresos`), del más reciente al más antiguo, paginadas en memoria.
     */
    async misLiquidaciones(query: MisLiquidacionesQuery, actor: Actor): Promise<MisLiquidaciones> {
      const fechaHoy = hoy(reloj)
      const profesorId = await profesorDeLaSesion(actor)
      const mesEnCurso = mesDe(fechaHoy)
      const filas = (await repository.todasDelProfesor({ profesorId, hoy: fechaHoy }))
        .filter((liquidacion) => liquidacion.mes !== mesEnCurso)
        .reverse()
        .map((liquidacion): FilaMiLiquidacion => ({
          mes: liquidacion.mes,
          estado: liquidacion.estado,
          total: liquidacion.total,
          fechaTransferencia:
            liquidacion.estado === 'PAGADA'
              ? (liquidacion.cerrada?.fechaTransferencia ?? null)
              : null,
        }))
      const { skip, take } = calcularSkipTake(query)
      return { data: filas.slice(skip, skip + take), meta: armarMeta(query, filas.length) }
    },

    /**
     * Una liquidación del profesor de la sesión (cualquier mes no futuro, también el en curso).
     * Sin movimientos en el mes: la liquidación vacía.
     */
    async miLiquidacion({ mes }: MiLiquidacionParams, actor: Actor): Promise<MiLiquidacion> {
      const fechaHoy = hoy(reloj)
      const profesorId = await profesorDeLaSesion(actor)
      exigirMesNoFuturo(mes, fechaHoy)
      const liquidacion = await repository.deProfesor({ profesorId, mes, hoy: fechaHoy })
      return liquidacion ? aMiLiquidacion(liquidacion) : miLiquidacionVacia(mes)
    },

    // ---------- El documento PDF (HU-44 y HU-45, T-125) ----------

    /**
     * La liquidación de `profesorId` en `mes` para el PDF, con el mismo cálculo del detalle. El
     * gerente saca la de cualquier profesor (con el número de comprobante); un profesor, sólo la
     * suya (sin él, decisión T-171) y 403 con la de otro. Orden de errores: 403 del profesor; 400
     * del mes futuro; 404 del profesor inexistente.
     */
    async documento(params: LiquidacionParams, actor: Actor): Promise<LiquidacionDocumento> {
      if (actor.role === 'PROFESOR' && (await profesorDeLaSesion(actor)) !== params.profesorId) {
        throw new ForbiddenError('No tenés permiso para esta operación')
      }
      return armarDocumento(params, actor)
    },

    /**
     * El PDF de la liquidación del profesor de la sesión (`mis-liquidaciones/{mes}/pdf`, para la
     * pantalla de T-133, que no conoce su `profesorId`): el mismo documento que `documento`.
     */
    async miDocumento({ mes }: MiLiquidacionParams, actor: Actor): Promise<LiquidacionDocumento> {
      const profesorId = await profesorDeLaSesion(actor)
      return armarDocumento({ profesorId, mes }, actor)
    },
  }
}

export type LiquidacionesService = ReturnType<typeof crearLiquidacionesService>
