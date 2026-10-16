'use client'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'
import { useProfesores } from '@/features/profesores/hooks/use-profesores'

import { useOpcionesDeCuenta } from '../hooks/use-opciones-de-cuenta'
import { etiquetaProfesor, profesoresDelFiltro } from '../opciones-de-cuenta'

type FiltroProfesorProps = {
  id: string
  /** Con alumno, solo los profesores de lo que tiene por cobrar (`useOpcionesDeCuenta`, T-177). */
  alumnoId: number | null
  value: number | null
  /** El nombre del profesor filtrado (`useNombresDeFiltros`); `null` mientras carga. */
  nombre: string | null
  onChange: (value: number | null) => void
}

/**
 * Filtro por profesor de `cuentas`.
 *
 * - **Sin alumno:** busca con el hook de `profesores` (hasta 10 por búsqueda, solo con el menú
 *   abierto), con `estado: 'TODOS'`: un turno adeudado puede ser de un profesor que ya fue dado de
 *   baja.
 * - **Con alumno** (decisión T-177): ofrece solo los profesores de lo que tiene por cobrar
 *   (`useOpcionesDeCuenta`, también los dados de baja), y lo escrito filtra esa lista en el
 *   cliente, como el filtro de materias.
 */
export function FiltroProfesor({ id, alumnoId, value, nombre, onChange }: FiltroProfesorProps) {
  const estado = useComboboxBuscador()
  const conAlumno = alumnoId !== null
  const busqueda = useProfesores(
    { estado: 'TODOS', q: estado.q || undefined, pageSize: 10 },
    estado.abierto && !conAlumno,
  )
  const deLaCuenta = useOpcionesDeCuenta(alumnoId)

  const opciones = conAlumno
    ? profesoresDelFiltro(deLaCuenta.data, estado.texto)
    : (busqueda.data?.data ?? []).map((profesor) => ({
        id: profesor.id,
        etiqueta: etiquetaProfesor(profesor),
      }))
  const isError = conAlumno ? deLaCuenta.isError : busqueda.isError

  return (
    <ComboboxBuscador
      id={id}
      // Con alumno la lista sale de lo escrito sin esperar al debounce, como en `SelectBuscable`.
      estado={conAlumno ? { ...estado, q: estado.texto } : estado}
      valor={value}
      textoValor={nombre}
      textoTodos="Todos"
      placeholderBusqueda="Buscar profesor…"
      textoSinResultados="No se encontraron profesores."
      opciones={opciones}
      buscando={conAlumno ? deLaCuenta.isLoading : busqueda.isFetching}
      error={isError ? 'No se pudieron buscar los profesores.' : null}
      onElegir={onChange}
    />
  )
}
