import { fetchJson } from '@/utils/fetch-json'

import type {
  ExamenCrear,
  ExamenDetalle,
  ExamenEditar,
  ExamenesListado,
  MateriaExamen,
  MisExamenesDeMateria,
  NotaCargar,
} from '../examenes.types'

const BASE = '/api/v1/examenes'

/** Exámenes activos del alumno, separados en próximos y pasados. */
export function listarExamenes(alumnoId: number): Promise<ExamenesListado> {
  return fetchJson<ExamenesListado>(`${BASE}?alumnoId=${alumnoId}`)
}

/**
 * Materias en las que se le puede cargar un examen nuevo a ese alumno: las de sus turnos activos de
 * hoy en adelante; para el profesor, solo los que tiene con él (lo decide la API según la sesión).
 */
export function listarMateriasExamen(alumnoId: number): Promise<MateriaExamen[]> {
  return fetchJson<MateriaExamen[]>(`${BASE}/materias?alumnoId=${alumnoId}`)
}

export function crearExamen(datos: ExamenCrear): Promise<ExamenDetalle> {
  return fetchJson<ExamenDetalle>(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function editarExamen(id: number, datos: ExamenEditar): Promise<ExamenDetalle> {
  return fetchJson<ExamenDetalle>(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

/** "Eliminar" un examen es darlo de baja: deja de listarse y de contar para la prioridad. */
export function eliminarExamen(id: number): Promise<ExamenDetalle> {
  return fetchJson<ExamenDetalle>(`${BASE}/${id}/baja`, { method: 'PATCH' })
}

/** Carga o corrige la nota de un examen ya rendido (HU-34). */
export function cargarNota(id: number, datos: NotaCargar): Promise<ExamenDetalle> {
  return fetchJson<ExamenDetalle>(`${BASE}/${id}/nota`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

/** Los exámenes del alumno de la sesión en una materia (portal, HU-35). */
export function obtenerMisExamenes(materiaId: number): Promise<MisExamenesDeMateria> {
  const params = new URLSearchParams({ materiaId: String(materiaId) })
  return fetchJson<MisExamenesDeMateria>(`${BASE}/mis-examenes?${params.toString()}`)
}
