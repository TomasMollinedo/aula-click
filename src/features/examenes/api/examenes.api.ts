import { fetchJson } from '@/utils/fetch-json'

import type {
  ExamenCrear,
  ExamenDetalle,
  ExamenEditar,
  ExamenesListado,
  MateriaExamen,
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
