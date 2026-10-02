'use client'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'
import { useProfesores } from '@/features/profesores/hooks/use-profesores'

type FiltroProfesorProps = {
  id: string
  value: number | null
  /** El nombre del profesor filtrado (`useNombresDeFiltros`); `null` mientras carga. */
  nombre: string | null
  onChange: (value: number | null) => void
}

/**
 * Filtro por profesor de `cuentas`: busca con el hook de `profesores` (hasta 10 por búsqueda, solo
 * con el menú abierto). Con `estado: 'TODOS'`: un turno adeudado puede ser de un profesor que ya
 * fue dado de baja.
 */
export function FiltroProfesor({ id, value, nombre, onChange }: FiltroProfesorProps) {
  const estado = useComboboxBuscador()
  const { data, isFetching, isError } = useProfesores(
    { estado: 'TODOS', q: estado.q || undefined, pageSize: 10 },
    estado.abierto,
  )

  return (
    <ComboboxBuscador
      id={id}
      estado={estado}
      valor={value}
      textoValor={nombre}
      textoTodos="Todos"
      placeholderBusqueda="Buscar profesor…"
      textoSinResultados="No se encontraron profesores."
      opciones={(data?.data ?? []).map((profesor) => ({
        id: profesor.id,
        etiqueta: `${profesor.apellido}, ${profesor.nombre}`,
      }))}
      buscando={isFetching}
      error={isError ? 'No se pudieron buscar los profesores.' : null}
      onElegir={onChange}
    />
  )
}
