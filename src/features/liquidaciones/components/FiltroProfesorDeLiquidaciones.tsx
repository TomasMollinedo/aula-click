'use client'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'
import { useProfesoresDePagos } from '@/features/pagos/hooks/use-buscadores-de-pagos'

type FiltroProfesorDeLiquidacionesProps = {
  id: string
  value: number | null
  onChange: (value: number | null) => void
}

/**
 * Filtro por profesor del listado de liquidaciones: busca por nombre o apellido entre los
 * profesores con algún turno cobrado, que son los que pueden tener una liquidación (el buscador es
 * el del gerente en `pagos`, que no puede usar `GET /profesores`; incluye a los dados de baja). Las
 * opciones se piden con `q` solo con el menú abierto; el nombre del elegido (el filtro de la URL
 * es un id), con `?id=`: si vuelve `[]`, "no encontrado".
 */
export function FiltroProfesorDeLiquidaciones({
  id,
  value,
  onChange,
}: FiltroProfesorDeLiquidacionesProps) {
  const estado = useComboboxBuscador()
  const busqueda = useProfesoresDePagos({ q: estado.q || undefined }, estado.abierto)
  const elegido = useProfesoresDePagos({ id: value ?? undefined }, value !== null)

  let textoValor: string | null = null
  if (value !== null && elegido.data) {
    const [profesor] = elegido.data
    textoValor = profesor ? `${profesor.apellido}, ${profesor.nombre}` : 'Profesor no encontrado'
  }

  return (
    <ComboboxBuscador
      id={id}
      estado={estado}
      valor={value}
      textoValor={textoValor}
      textoTodos="Todos los profesores"
      placeholderBusqueda="Buscar profesor…"
      textoSinResultados="No se encontraron profesores."
      opciones={(busqueda.data ?? []).map((profesor) => ({
        id: profesor.id,
        etiqueta: `${profesor.apellido}, ${profesor.nombre}`,
      }))}
      buscando={busqueda.isFetching}
      error={busqueda.isError ? 'No se pudieron buscar los profesores.' : null}
      onElegir={onChange}
    />
  )
}
