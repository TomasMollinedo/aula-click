// Tipos de los pagos realizados (`GET /pagos`, HU-36) y de los buscadores de sus filtros
// (`GET /pagos/alumnos` y `GET /pagos/profesores`), según docs/contrato-api.md → Pagos. Los
// importes y los totales los calcula la API: la UI solo los muestra. Fechas: string `YYYY-MM-DD`.

import type { PaginatedResponse, UsuarioAuditoria } from '@/types'
import type { EstadoPagoRegistrado } from '@/types/pago'

import type { CodigoFormaPago, MotivoAnulacion } from './pago-detalle.types'

/** Un pago del listado, vigente o anulado (un anulado se lista, pero no suma). */
export type PagoRealizado = {
  id: number
  numeroComprobante: number
  fechaPago: string
  alumno: { id: number; nombre: string; apellido: string }
  /** Las materias distintas de sus turnos, por nombre. */
  materias: { id: number; nombre: string }[]
  /** Cuántos turnos incluye. */
  cantidad: number
  total: number
  formaPago: { codigo: CodigoFormaPago; nombre: string }
  registradoPor: UsuarioAuditoria
  estado: EstadoPagoRegistrado
  /** Motivo y detalle si está anulado; `null` si está vigente. */
  anulacion: { motivo: MotivoAnulacion; detalle: string | null } | null
}

/**
 * Lo cobrado de **todo** el filtro (no de la página), solo con los pagos vigentes: `cobrado` es la
 * suma de `porForma`, que la hace la API.
 */
export type TotalesPagosRealizados = {
  cobrado: number
  porForma: Record<CodigoFormaPago, number>
}

/** Respuesta de `GET /pagos`: el listado paginado más `totales`, junto a `data` y `meta`. */
export type ListadoPagosRealizados = PaginatedResponse<PagoRealizado> & {
  totales: TotalesPagosRealizados
}

/** Query de `GET /pagos`: el período es obligatorio; los vacíos no se mandan. */
export type ListarPagosRealizadosParams = {
  desde: string
  hasta: string
  alumnoId?: number
  materiaId?: number
  profesorId?: number
  formaPago?: CodigoFormaPago
  page: number
}

/** Una opción de un buscador de los filtros: solo id, nombre y apellido (ni DNI ni foto). */
export type OpcionBuscadorPagos = { id: number; nombre: string; apellido: string }

/** Una opción del buscador de materias: solo id y nombre. */
export type OpcionMateriaDePagos = { id: number; nombre: string }

/** Query de un buscador: `q` por palabras y/o una sola opción por su `id`. */
export type BuscadorPagosParams = { q?: string; id?: number }

/**
 * Query de los buscadores de profesores y materias: además, `alumnoId` acota las opciones a las de
 * los pagos de ese alumno (decisión T-170).
 */
export type BuscadorAcotadoParams = BuscadorPagosParams & { alumnoId?: number }
