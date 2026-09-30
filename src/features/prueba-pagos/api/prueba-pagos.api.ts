// TEMPORAL (T-52): arnés de prueba del registro de pagos. Se borra entero (`src/features/prueba-pagos/`
// y `src/app/mesa/prueba-pagos/`) cuando T-44 (detalle del turno) y T-54 (pestaña Pagos) permitan
// probar el pago desde la app. Ver el issue enlazado en el PR de T-52.

import type { PaginatedResponse } from '@/types'
import { fetchJson } from '@/utils/fetch-json'

/** Lo que el arnés lee de `GET /materias`: el precio vigente (el tipo de `materias` lo suma T-40). */
export type PrecioMateria = { id: number; nombre: string; precioHora: number | null }

/** Precio por hora de cada materia, para mostrar el importe que mandaría quien abre el diálogo. */
export async function listarPreciosMaterias(): Promise<Map<number, number | null>> {
  const respuesta = await fetchJson<PaginatedResponse<PrecioMateria>>(
    '/api/v1/materias?page=1&pageSize=100',
  )
  return new Map(respuesta.data.map((materia) => [materia.id, materia.precioHora ?? null]))
}
