'use client'

import { Field } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMateriasSelector } from '@/features/materias/hooks/use-materias-selector'
import { useProfesores } from '@/features/profesores/hooks/use-profesores'
import { DIAS_SEMANA } from '@/utils/dias-semana'

// Radix no admite value="": un valor especial representa "sin filtrar".
const TODOS = '__TODOS__'

/** Máximo `pageSize` de la API: el selector trae de una vez a todos los profesores de la materia. */
const MAX_PROFESORES = 100

export type FiltrosBusqueda = {
  materiaId: number | null
  diaSemana: number | null
  profesorId: number | null
}

export const FILTROS_VACIOS: FiltrosBusqueda = {
  materiaId: null,
  diaSemana: null,
  profesorId: null,
}

type FiltrosDisponibilidadProps = {
  filtros: FiltrosBusqueda
  onCambio: (filtros: FiltrosBusqueda) => void
}

/**
 * Paso 2 (filtros): materia (obligatoria), día y profesor (opcionales y combinables). Son selects:
 * la búsqueda se dispara al cambiarlos. El profesor se habilita con la materia y se limpia si
 * cambia la materia (un profesor de otra materia daría `[]`).
 */
export function FiltrosDisponibilidad({ filtros, onCambio }: FiltrosDisponibilidadProps) {
  const materias = useMateriasSelector()
  const profesores = useProfesores(
    { materiaId: filtros.materiaId ?? undefined, estado: 'ACTIVO', pageSize: MAX_PROFESORES },
    filtros.materiaId !== null,
  )
  // Con la lista de otra materia (placeholder), el selector no ofrece nada hasta que llega la nueva.
  const listaProfesores = profesores.isPlaceholderData ? undefined : profesores.data?.data

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Materia" htmlFor="filtro-materia" required>
        <Select
          value={filtros.materiaId === null ? '' : String(filtros.materiaId)}
          onValueChange={(v) => onCambio({ ...filtros, materiaId: Number(v), profesorId: null })}
          disabled={materias.isLoading || materias.isError}
        >
          <SelectTrigger id="filtro-materia" className="w-full" aria-required>
            <SelectValue
              placeholder={
                materias.isLoading
                  ? 'Cargando materias…'
                  : materias.isError
                    ? 'No se pudieron cargar las materias'
                    : 'Elegí una materia'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {materias.data?.map((materia) => (
              <SelectItem key={materia.id} value={String(materia.id)}>
                {materia.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {materias.data?.length === 0 && (
          <p className="text-muted-foreground text-xs">No hay materias activas.</p>
        )}
      </Field>

      <Field label="Día" htmlFor="filtro-dia" optional>
        <Select
          value={filtros.diaSemana === null ? TODOS : String(filtros.diaSemana)}
          onValueChange={(v) => onCambio({ ...filtros, diaSemana: v === TODOS ? null : Number(v) })}
        >
          <SelectTrigger id="filtro-dia" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los días</SelectItem>
            {DIAS_SEMANA.map(({ dia, nombre }) => (
              <SelectItem key={dia} value={String(dia)}>
                {nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Profesor" htmlFor="filtro-profesor" optional>
        <Select
          value={
            !listaProfesores ? '' : filtros.profesorId === null ? TODOS : String(filtros.profesorId)
          }
          onValueChange={(v) =>
            onCambio({ ...filtros, profesorId: v === TODOS ? null : Number(v) })
          }
          disabled={filtros.materiaId === null || !listaProfesores}
        >
          <SelectTrigger id="filtro-profesor" className="w-full">
            <SelectValue
              placeholder={filtros.materiaId === null ? 'Elegí primero la materia' : 'Cargando…'}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los profesores</SelectItem>
            {listaProfesores?.map((profesor) => (
              <SelectItem key={profesor.id} value={String(profesor.id)}>
                {profesor.apellido}, {profesor.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {profesores.isError && (
          <p className="text-destructive text-xs">
            {profesores.error.status === 403
              ? 'No tenés permiso para ver los profesores'
              : 'No se pudieron cargar los profesores'}
          </p>
        )}
      </Field>
    </div>
  )
}
