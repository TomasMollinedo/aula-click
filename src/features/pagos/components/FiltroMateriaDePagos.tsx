'use client'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'

import { useMateriasDePagos } from '../hooks/use-buscadores-de-pagos'

type FiltroMateriaDePagosProps = {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  /** Acota las opciones a las materias de los pagos de este alumno (decisión T-170). */
  alumnoId?: number
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Filtro por una materia de "Pagos realizados", sobre el buscador de `pagos` (`GET
 * /pagos/materias`): las materias de algún turno pagado, incluidas las dadas de baja, y con
 * `alumnoId` solo las de los pagos de ese alumno. Las opciones se piden con `q` solo con el menú
 * abierto; el nombre de la elegida, con `?id=` y sin `alumnoId` (así no se pierde al cambiar de
 * alumno): si vuelve `[]`, "Materia no encontrada". Mesa de entradas y el gerente pueden usar los dos.
 */
export function FiltroMateriaDePagos({
  id,
  value,
  onChange,
  alumnoId,
  ...aria
}: FiltroMateriaDePagosProps) {
  const estado = useComboboxBuscador()
  const busqueda = useMateriasDePagos({ q: estado.q || undefined, alumnoId }, estado.abierto)
  const elegida = useMateriasDePagos({ id: value ?? undefined }, value !== null)

  let textoValor: string | null = null
  if (value !== null && elegida.data) {
    const [materia] = elegida.data
    textoValor = materia ? materia.nombre : 'Materia no encontrada'
  }

  return (
    <ComboboxBuscador
      id={id}
      estado={estado}
      valor={value}
      textoValor={textoValor}
      textoTodos="Todas"
      placeholderBusqueda="Buscar materia…"
      textoSinResultados="No se encontraron materias con turnos pagados."
      opciones={(busqueda.data ?? []).map((materia) => ({
        id: materia.id,
        etiqueta: materia.nombre,
      }))}
      buscando={busqueda.isFetching}
      error={busqueda.isError ? 'No se pudieron buscar las materias.' : null}
      onElegir={onChange}
      aria-invalid={aria['aria-invalid']}
      aria-describedby={aria['aria-describedby']}
    />
  )
}
