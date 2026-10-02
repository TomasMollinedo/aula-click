'use client'

import { useId } from 'react'

import { Field } from '@/components/ui/field'
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

type TextosFiltroGrilla = {
  label: string
  textoTodas: string
  etiquetaBusqueda: string
  textoVacio: string
}

function FiltroGrilla({ label, ...props }: FiltroGrillaProps & TextosFiltroGrilla) {
  const id = useId()

  return (
    <Field label={label} htmlFor={id}>
      <SelectBuscable id={id} {...props} />
    </Field>
  )
}

export function FiltroAlumno(props: FiltroGrillaProps) {
  return (
    <FiltroGrilla
      {...props}
      label="Alumno"
      textoTodas="Todos"
      etiquetaBusqueda="Buscar alumno"
      textoVacio="No se encontraron alumnos."
    />
  )
}

export function FiltroMateria(props: FiltroGrillaProps) {
  return (
    <FiltroGrilla
      {...props}
      label="Materia"
      textoTodas="Todas"
      etiquetaBusqueda="Buscar materia"
      textoVacio="No se encontraron materias."
    />
  )
}

export function FiltroAula(props: FiltroGrillaProps) {
  return (
    <FiltroGrilla
      {...props}
      label="Aula"
      textoTodas="Todas"
      etiquetaBusqueda="Buscar aula"
      textoVacio="No se encontraron aulas."
    />
  )
}
