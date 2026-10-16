'use client'

import type { UseQueryResult } from '@tanstack/react-query'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'
import type { ApiError } from '@/utils/fetch-json'

import { useAlumnosDePagos, useProfesoresDePagos } from '../hooks/use-buscadores-de-pagos'
import type { OpcionBuscadorPagos } from '../pagos-realizados.types'

// Los filtros por alumno y por profesor de "Pagos realizados", sobre los buscadores de `pagos`
// (decisión T-169), para mesa de entradas y el gerente. Las opciones se piden con `q` solo con el
// menú abierto; el nombre del elegido (el filtro de la URL es un id), con `?id=`: si vuelve `[]`,
// "no encontrado".

type FiltroPersonaProps = {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

type Textos = {
  placeholder: string
  sinResultados: string
  noEncontrado: string
  error: string
}

type Consulta = UseQueryResult<OpcionBuscadorPagos[], ApiError>

/** `'Álvarez, Lucía'`. */
function etiqueta(persona: OpcionBuscadorPagos): string {
  return `${persona.apellido}, ${persona.nombre}`
}

function ComboboxPersona({
  id,
  value,
  onChange,
  estado,
  busqueda,
  elegido,
  textos,
  ...aria
}: FiltroPersonaProps & {
  estado: ReturnType<typeof useComboboxBuscador>
  busqueda: Consulta
  elegido: Consulta
  textos: Textos
}) {
  let textoValor: string | null = null
  if (value !== null && elegido.data) {
    const [persona] = elegido.data
    textoValor = persona ? etiqueta(persona) : textos.noEncontrado
  }

  return (
    <ComboboxBuscador
      id={id}
      estado={estado}
      valor={value}
      textoValor={textoValor}
      textoTodos="Todos"
      placeholderBusqueda={textos.placeholder}
      textoSinResultados={textos.sinResultados}
      opciones={(busqueda.data ?? []).map((persona) => ({
        id: persona.id,
        etiqueta: etiqueta(persona),
      }))}
      buscando={busqueda.isFetching}
      error={busqueda.isError ? textos.error : null}
      onElegir={onChange}
      aria-invalid={aria['aria-invalid']}
      aria-describedby={aria['aria-describedby']}
    />
  )
}

/** Filtro por alumno de la vista global: los alumnos con algún pago (`GET /pagos/alumnos`). */
export function FiltroAlumnoDePagos(props: FiltroPersonaProps) {
  const estado = useComboboxBuscador()
  const busqueda = useAlumnosDePagos({ q: estado.q || undefined }, estado.abierto)
  const elegido = useAlumnosDePagos({ id: props.value ?? undefined }, props.value !== null)
  return (
    <ComboboxPersona
      {...props}
      estado={estado}
      busqueda={busqueda}
      elegido={elegido}
      textos={{
        placeholder: 'Buscar por DNI, nombre o apellido…',
        sinResultados: 'No se encontraron alumnos con pagos.',
        noEncontrado: 'Alumno no encontrado',
        error: 'No se pudieron buscar los alumnos.',
      }}
    />
  )
}

/**
 * Filtro por profesor: los que dictaron algún turno pagado (`GET /pagos/profesores`). Con
 * `alumnoId`, las opciones son solo las de los pagos de ese alumno (decisión T-170); el nombre del
 * elegido se pide sin él, así no se pierde al cambiar de alumno.
 */
export function FiltroProfesorDePagos({
  alumnoId,
  ...props
}: FiltroPersonaProps & { alumnoId?: number }) {
  const estado = useComboboxBuscador()
  const busqueda = useProfesoresDePagos({ q: estado.q || undefined, alumnoId }, estado.abierto)
  const elegido = useProfesoresDePagos({ id: props.value ?? undefined }, props.value !== null)
  return (
    <ComboboxPersona
      {...props}
      estado={estado}
      busqueda={busqueda}
      elegido={elegido}
      textos={{
        placeholder: 'Buscar profesor…',
        sinResultados: 'No se encontraron profesores con turnos pagados.',
        noEncontrado: 'Profesor no encontrado',
        error: 'No se pudieron buscar los profesores.',
      }}
    />
  )
}
