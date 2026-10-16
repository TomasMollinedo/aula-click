import { ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { alumnoDeLaSesion, type Actor } from '@/server/shared/actor'
import { terminosDeBusqueda } from '@/server/shared/busqueda'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { PagosRepository } from './pagos.repository'
import {
  accionesDelPago,
  calcularVuelto,
  MENSAJE_FECHA_PAGO_FUTURA,
  medioDelPedido,
  montoRecibidoDe,
  planificarPago,
  sumarImportes,
  type PedidoPago,
} from './pagos.reglas'
import type {
  AlumnoDePagos,
  BuscadorAcotadoQuery,
  BuscadorPagosQuery,
  BusquedaAcotadaDePagos,
  Comprobante,
  DetallePago,
  ListadoPagos,
  ListarPagosQuery,
  MateriaDePagos,
  MisPagos,
  MisPagosQuery,
  PagoRegistrado,
  ProfesorDePagos,
  RegistrarPago,
} from './pagos.validation'

// Reglas de negocio del cobro (HU-15, T-51; formas de pago, HU-23, T-96). No conoce HTTP ni Prisma:
// lanza AppError o sus subclases. Qué se puede cobrar, el total y el vuelto los decide
// `planificarPago` (puro); del alumno sólo lee, por su repository. El importe no depende del medio.
// Pagos realizados, detalle con acciones y "Mis pagos" (HU-36, HU-37, T-98): las acciones las
// decide `accionesDelPago` (puro) y el alumno del portal sale de la sesión.

/** 403 del PDF de un pago de otro alumno (HU-37). */
export const MENSAJE_PAGO_AJENO = 'El pago no es suyo'

/** El query de un buscador acotado, con `q` ya partido en términos. */
function busquedaAcotada(query: BuscadorAcotadoQuery): BusquedaAcotadaDePagos {
  return { terminos: terminosDeBusqueda(query.q), id: query.id, alumnoId: query.alumnoId }
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearPagosService({
  repository,
  alumnosRepository,
  reloj,
}: {
  repository: Pick<
    PagosRepository,
    | 'leerSnapshot'
    | 'registrar'
    | 'buscarComprobante'
    | 'listarRealizados'
    | 'listarDelAlumno'
    | 'buscarAdjunto'
    | 'buscarAlumnos'
    | 'buscarProfesores'
    | 'buscarMaterias'
  >
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  /** Datos del comprobante. El vuelto se recalcula, nunca se lee de la base. 404 si no existe. */
  async function leerComprobante(id: number): Promise<Comprobante> {
    const comprobante = await repository.buscarComprobante(id)
    if (!comprobante) throw new NotFoundError('Pago no encontrado')
    return {
      ...comprobante,
      vuelto: calcularVuelto(comprobante.montoRecibido, comprobante.total),
    }
  }

  return {
    /**
     * Registra el pago de una o varias ocurrencias de un alumno, todo o nada. Chequeos, en orden
     * (el primero que falla gana):
     * 1. El body ya lo validó Zod (400), incluidos los datos de su forma de pago (un pago, un
     *    medio: `montoRecibido` en efectivo, `transferencia` y el adjunto en transferencia, `debito`
     *    en débito).
     * 2. `fechaPago` posterior a hoy → 400 en `fechaPago`.
     * 3. Alumno inexistente → 404 (su estado no importa: una deuda se cobra igual).
     * 4. Chequeo previo sin lock (`planificarPago` sobre el snapshot): ocurrencia de otro alumno
     *    → 400; alguna no cobrable → 409 `TURNOS_NO_COBRABLES`; total fuera de rango o, en
     *    efectivo, `montoRecibido` menor al total → 400.
     * 5. `repository.registrar`, que bloquea el alumno, relee y vuelve a decidir con la misma
     *    regla antes de escribir, y vincula el comprobante adjunto (400 `ADJUNTO_INVALIDO` si no es
     *    uno disponible de quien cobra). La respuesta sale del plan decidido bajo lock.
     */
    async registrar(datos: RegistrarPago, actor: Actor): Promise<PagoRegistrado> {
      const fechaHoy = hoy(reloj)
      if (datos.fechaPago > fechaHoy) {
        throw new ValidationError(MENSAJE_FECHA_PAGO_FUTURA, {
          details: [{ path: ['fechaPago'], message: MENSAJE_FECHA_PAGO_FUTURA }],
        })
      }

      const alumno = await alumnosRepository.buscarPorId(datos.alumnoId)
      if (!alumno) throw new NotFoundError('Alumno no encontrado')

      const medio = medioDelPedido(datos)
      const montoRecibido = montoRecibidoDe(medio)
      const pedido: PedidoPago = {
        alumnoId: datos.alumnoId,
        ocurrencias: datos.ocurrencias,
        montoRecibido,
      }
      const verificar = (snapshot: Parameters<typeof planificarPago>[0]) =>
        planificarPago(snapshot, pedido, fechaHoy)

      verificar(await repository.leerSnapshot(datos.ocurrencias, reloj))

      const { pagoId, numeroComprobante, plan } = await repository.registrar(
        {
          alumnoId: datos.alumnoId,
          ocurrencias: datos.ocurrencias,
          fechaPago: datos.fechaPago,
          medio,
          observaciones: datos.observaciones ?? null,
        },
        verificar,
        actor,
        reloj,
      )
      return {
        pagoId,
        numeroComprobante,
        cantidad: plan.lineas.length,
        total: plan.total,
        formaPago: medio.formaPago,
        montoRecibido,
        vuelto: plan.vuelto,
      }
    },

    /**
     * Pagos realizados (HU-36): la página del filtro, vigentes y anulados, y los totales de
     * **todo** el filtro sin los anulados. `cobrado` es la suma de las tres formas, en centavos. El
     * período ya viene en orden (lo valida el query). Un alumno, una materia o un profesor que no
     * existen dan una lista vacía y los totales en 0, sin 404.
     */
    async listar(query: ListarPagosQuery): Promise<ListadoPagos> {
      const { page, pageSize, ...filtro } = query
      const { data, meta, porForma } = await repository.listarRealizados(filtro, {
        page,
        pageSize,
      })
      return { data, meta, totales: { cobrado: sumarImportes(Object.values(porForma)), porForma } }
    },

    /**
     * Detalle del pago (HU-36): el comprobante, la cantidad de turnos, el último adjunto activo y
     * las acciones de quien lo pide (`accionesDelPago`). 404 si no existe.
     */
    async obtenerDetalle(id: number, actor: Actor): Promise<DetallePago> {
      const comprobante = await leerComprobante(id)
      const adjunto = await repository.buscarAdjunto(id)
      return {
        ...comprobante,
        cantidad: comprobante.turnos.length,
        adjunto,
        acciones: accionesDelPago({
          rol: actor.role,
          estado: comprobante.estado,
          formaPago: comprobante.formaPago.codigo,
          tieneAdjunto: adjunto !== null,
        }),
      }
    },

    /**
     * El comprobante para el PDF: el mismo documento para todos los roles, sin leer el adjunto.
     * Para el alumno (HU-37), en este orden: cuenta sin alumno → 403; pago inexistente → 404; pago
     * de otro alumno → 403 `SIN_PERMISO` (como `miTurno` de ocurrencias).
     */
    async comprobanteParaDocumento(id: number, actor: Actor): Promise<Comprobante> {
      const alumnoId = actor.role === 'ALUMNO' ? alumnoDeLaSesion(actor) : null
      const comprobante = await leerComprobante(id)
      if (alumnoId !== null && comprobante.alumno.id !== alumnoId) {
        throw new ForbiddenError(MENSAJE_PAGO_AJENO)
      }
      return comprobante
    },

    /**
     * Los pagos del alumno de la sesión (HU-37), vigentes y anulados, del más reciente al más
     * antiguo. Nunca recibe un `alumnoId`: 403 si la cuenta no tiene alumno.
     */
    async misPagos(query: MisPagosQuery, actor: Actor): Promise<MisPagos> {
      return repository.listarDelAlumno(alumnoDeLaSesion(actor), query)
    },

    /**
     * Buscador de alumnos para el filtro de pagos realizados (HU-36, T-100): los que tienen algún
     * pago, por palabras (`terminosDeBusqueda`, como `GET /alumnos`) y/o por `id`. Sin pagos o sin
     * coincidencias, `[]`.
     */
    async buscarAlumnos(query: BuscadorPagosQuery): Promise<AlumnoDePagos[]> {
      return repository.buscarAlumnos({ terminos: terminosDeBusqueda(query.q), id: query.id })
    },

    /**
     * Lo mismo con los profesores que dictan algún turno incluido en un pago (T-100); con
     * `alumnoId`, en un pago de ese alumno (decisión T-170).
     */
    async buscarProfesores(query: BuscadorAcotadoQuery): Promise<ProfesorDePagos[]> {
      return repository.buscarProfesores(busquedaAcotada(query))
    },

    /** Lo mismo con las materias de algún turno incluido en un pago (decisión T-170). */
    async buscarMaterias(query: BuscadorAcotadoQuery): Promise<MateriaDePagos[]> {
      return repository.buscarMaterias(busquedaAcotada(query))
    },
  }
}
