'use client'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'
import { useMateria } from '@/features/materias/hooks/use-materia'
import { useMaterias } from '@/features/materias/hooks/use-materias'

type FiltroMateriaDePagosProps = {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Filtro por una materia de "Pagos realizados": busca con el hook de `materias` (hasta 10 por
 * búsqueda, solo con el menú abierto) con `estado: 'TODOS'`, porque un pago puede ser de una
 * materia que después se dio de baja. El nombre de la elegida sale de `useMateria`; si no existe,
 * "Materia no encontrada". Mesa de entradas y el gerente pueden usar los dos.
 */
export function FiltroMateriaDePagos({ id, value, onChange, ...aria }: FiltroMateriaDePagosProps) {
  const estado = useComboboxBuscador()
  const { data, isFetching, isError } = useMaterias(
    { estado: 'TODOS', q: estado.q || undefined, pageSize: 10 },
    estado.abierto,
  )
  const elegida = useMateria(value ?? 0)

  let textoValor: string | null = null
  if (value !== null) {
    if (elegida.data) textoValor = elegida.data.nombre
    else if (elegida.isError) {
      textoValor = elegida.error.status === 404 ? 'Materia no encontrada' : 'Materia no disponible'
    }
  }

  return (
    <ComboboxBuscador
      id={id}
      estado={estado}
      valor={value}
      textoValor={textoValor}
      textoTodos="Todas"
      placeholderBusqueda="Buscar materia…"
      textoSinResultados="No se encontraron materias."
      opciones={(data?.data ?? []).map((materia) => ({ id: materia.id, etiqueta: materia.nombre }))}
      buscando={isFetching}
      error={isError ? 'No se pudieron buscar las materias.' : null}
      onElegir={onChange}
      aria-invalid={aria['aria-invalid']}
      aria-describedby={aria['aria-describedby']}
    />
  )
}
