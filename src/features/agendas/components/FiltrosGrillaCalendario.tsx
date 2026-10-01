'use client'

import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { FiltrosGrilla } from '../calendario'

type Referencia = { id: number; nombre: string }

// Radix Select no admite un valor vacío: "sin filtro" es este valor y se traduce a `null`.
const TODAS = 'TODAS'

type FiltrosGrillaCalendarioProps = {
  valor: FiltrosGrilla
  onChange: (cambios: Partial<FiltrosGrilla>) => void
  /** Las materias y las aulas de la semana que se está viendo. */
  materias: readonly Referencia[]
  aulas: readonly Referencia[]
}

// La opción elegida se conserva en la lista aunque en la semana que se mira no haya nada de ella:
// así el selector sigue diciendo qué filtro hay puesto en vez de quedar en blanco.
function conElegida(opciones: readonly Referencia[], elegida: Referencia | null): Referencia[] {
  return elegida && !opciones.some((opcion) => opcion.id === elegida.id)
    ? [...opciones, elegida]
    : [...opciones]
}

/**
 * Buscar un alumno y filtrar por materia y por aula en el calendario (HU-19). Se aplican sobre la
 * semana que ya llegó (`filtrarOcurrencias`), así responden al instante; el estado vive en
 * `CalendarioSemanal`, que no los guarda en la URL.
 */
export function FiltrosGrillaCalendario({
  valor,
  onChange,
  materias,
  aulas,
}: FiltrosGrillaCalendarioProps) {
  const opcionesMaterias = conElegida(materias, valor.materia)
  const opcionesAulas = conElegida(aulas, valor.aula)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Buscar y filtrar">
      <SearchInput
        value={valor.q}
        onValueChange={(q) => onChange({ q })}
        placeholder="Buscar alumno…"
        aria-label="Buscar alumno"
        className="w-full sm:w-56"
      />

      <Select
        value={valor.materia ? String(valor.materia.id) : TODAS}
        onValueChange={(id) =>
          onChange({ materia: opcionesMaterias.find((m) => String(m.id) === id) ?? null })
        }
      >
        <SelectTrigger aria-label="Filtrar por materia" className="h-9 w-full rounded-md sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas las materias</SelectItem>
          {opcionesMaterias.map((materia) => (
            <SelectItem key={materia.id} value={String(materia.id)}>
              {materia.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={valor.aula ? String(valor.aula.id) : TODAS}
        onValueChange={(id) =>
          onChange({ aula: opcionesAulas.find((a) => String(a.id) === id) ?? null })
        }
      >
        <SelectTrigger aria-label="Filtrar por aula" className="h-9 w-full rounded-md sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas las aulas</SelectItem>
          {opcionesAulas.map((aula) => (
            <SelectItem key={aula.id} value={String(aula.id)}>
              {aula.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
