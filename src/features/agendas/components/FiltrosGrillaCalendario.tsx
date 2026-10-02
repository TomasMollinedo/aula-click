'use client'

import { SelectBuscable } from '@/components/ui/select-buscable'

type Referencia = { id: number; nombre: string }

// Los filtros propios del calendario (HU-19): alumno, materia y aula son selectores con buscador,
// como el de profesor. Se aplican sobre la semana que ya llegó (`filtrarOcurrencias`), así
// responden al instante; el estado vive en `CalendarioSemanal`, que no los guarda en la URL. Cada
// uno es un componente aparte para que el calendario los intercale con los de la API en su fila. La
// opción elegida se muestra aunque en la semana que se mira no haya nada de ella: así el selector
// sigue diciendo qué filtro hay puesto en vez de quedar en blanco.

type FiltroGrillaProps = {
  /** Lo que hay para elegir en la semana que se está viendo. */
  opciones: readonly Referencia[]
  value: Referencia | null
  onChange: (valor: Referencia | null) => void
}

export function FiltroAlumno({ opciones, value, onChange }: FiltroGrillaProps) {
  return (
    <SelectBuscable
      opciones={opciones}
      value={value}
      onChange={onChange}
      textoTodas="Todos los alumnos"
      etiquetaBusqueda="Buscar alumno"
      textoVacio="No se encontraron alumnos."
      aria-label="Filtrar por alumno"
      className="w-full sm:w-48"
    />
  )
}

export function FiltroMateria({ opciones, value, onChange }: FiltroGrillaProps) {
  return (
    <SelectBuscable
      opciones={opciones}
      value={value}
      onChange={onChange}
      textoTodas="Todas las materias"
      etiquetaBusqueda="Buscar materia"
      textoVacio="No se encontraron materias."
      aria-label="Filtrar por materia"
      className="w-full sm:w-44"
    />
  )
}

export function FiltroAula({ opciones, value, onChange }: FiltroGrillaProps) {
  return (
    <SelectBuscable
      opciones={opciones}
      value={value}
      onChange={onChange}
      textoTodas="Todas las aulas"
      etiquetaBusqueda="Buscar aula"
      textoVacio="No se encontraron aulas."
      aria-label="Filtrar por aula"
      className="w-full sm:w-40"
    />
  )
}
