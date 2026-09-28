import { fetchJson } from '@/utils/fetch-json'

import type {
  Bloque,
  BloqueCrear,
  BloqueDetalle,
  BloqueEditar,
  BloqueHorario,
  BloquesLote,
  ListarProfesoresParams,
  MateriaAsignada,
  ProfesorCrear,
  ProfesorDetalle,
  ProfesorEditar,
  ProfesoresListadoResponse,
} from '../profesores.types'

const BASE = '/api/v1/profesores'

export function listarProfesores(
  params: ListarProfesoresParams,
): Promise<ProfesoresListadoResponse> {
  const searchParams = new URLSearchParams()
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  if (params.q) searchParams.set('q', params.q)
  if (params.estado) searchParams.set('estado', params.estado)
  if (params.materiaId != null) searchParams.set('materiaId', String(params.materiaId))

  const qs = searchParams.toString()
  return fetchJson<ProfesoresListadoResponse>(qs ? `${BASE}?${qs}` : BASE)
}

export function obtenerProfesor(id: number): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}`)
}

export function crearProfesor(datos: ProfesorCrear): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function editarProfesor(id: number, cambios: ProfesorEditar): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
}

/** Baja lógica del profesor (la de su Usuario). 409 `TURNOS_VIGENTES` si tiene turnos vigentes. */
export function darDeBajaProfesor(id: number): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}/baja`, { method: 'PATCH' })
}

/** Reactivación: vuelve el profesor a ACTIVO. No revalida nada. */
export function reactivarProfesor(id: number): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}/reactivacion`, { method: 'PATCH' })
}

/** Multipart con un único campo `foto` (JPG o PNG, hasta 5 MB). Reemplaza la anterior si tenía. */
export function subirFotoProfesor(id: number, foto: File): Promise<ProfesorDetalle> {
  const formData = new FormData()
  formData.set('foto', foto)
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}/foto`, {
    method: 'POST',
    body: formData,
  })
}

export function quitarFotoProfesor(id: number): Promise<ProfesorDetalle> {
  return fetchJson<ProfesorDetalle>(`${BASE}/${id}/foto`, { method: 'DELETE' })
}

/** Materias con asignación activa, sin paginar. Se listan aunque el profesor esté inactivo. */
export function listarMateriasAsignadas(id: number): Promise<MateriaAsignada[]> {
  return fetchJson<MateriaAsignada[]>(`${BASE}/${id}/materias`)
}

/** Materias del profesor de la sesión (rol PROFESOR): el `id` sale de la cookie, no se pasa. */
export function listarMisMaterias(): Promise<MateriaAsignada[]> {
  return fetchJson<MateriaAsignada[]>(`${BASE}/mis-materias`)
}

/** Asigna una o varias materias (todas o ninguna); devuelve las asignadas actualizadas. */
export function asignarMaterias(id: number, materiaIds: number[]): Promise<MateriaAsignada[]> {
  return fetchJson<MateriaAsignada[]>(`${BASE}/${id}/materias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ materiaIds }),
  })
}

/** Baja lógica de una o varias asignaciones (todas o ninguna); devuelve las que quedan. */
export function quitarMaterias(id: number, materiaIds: number[]): Promise<MateriaAsignada[]> {
  return fetchJson<MateriaAsignada[]>(`${BASE}/${id}/materias`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ materiaIds }),
  })
}

// Horario de atención (bloques). Es su propia feature en la API (`/api/v1/bloques`, T-29), con el
// profesor en la query o el body; en la UI es una sección de la ficha del profesor.
const BLOQUES = '/api/v1/bloques'

/** Filas activas del profesor (una por hora), ordenadas por día y hora, sin paginar. */
export function listarHorarioProfesor(profesorId: number): Promise<BloqueHorario[]> {
  return fetchJson<BloqueHorario[]>(`${BLOQUES}?profesorId=${profesorId}`)
}

/** Una hora del horario, activa o dada de baja, con su auditoría. */
export function obtenerBloque(bloqueId: number): Promise<BloqueDetalle> {
  return fetchJson<BloqueDetalle>(`${BLOQUES}/${bloqueId}`)
}

export function crearBloque(datos: BloqueCrear): Promise<BloquesLote> {
  return fetchJson<BloquesLote>(BLOQUES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function editarBloque(bloqueId: number, cambios: BloqueEditar): Promise<Bloque> {
  return fetchJson<Bloque>(`${BLOQUES}/${bloqueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
}

/** Baja lógica de una hora. */
export function eliminarBloque(bloqueId: number): Promise<Bloque> {
  return fetchJson<Bloque>(`${BLOQUES}/${bloqueId}`, { method: 'DELETE' })
}

/** Baja lógica de varias horas del mismo profesor, todas o ninguna (hasta 24). */
export function eliminarBloques(bloqueIds: number[]): Promise<BloquesLote> {
  return fetchJson<BloquesLote>(BLOQUES, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bloqueIds }),
  })
}
