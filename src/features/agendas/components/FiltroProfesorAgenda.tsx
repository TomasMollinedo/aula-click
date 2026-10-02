'use client'

import { useId } from 'react'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'
import { Field } from '@/components/ui/field'
import { useProfesor } from '@/features/profesores/hooks/use-profesor'
import { useProfesores } from '@/features/profesores/hooks/use-profesores'

type FiltroProfesorAgendaProps = {
  value: number | null
  onChange: (value: number | null) => void
}

// Buscador con debounce en vez de traer y listar todos los profesores: cada tecla pide al
// backend solo los que coinciden (hasta 10), como el resto de los buscadores de la app.
export function FiltroProfesorAgenda({ value, onChange }: FiltroProfesorAgendaProps) {
  const id = useId()
  const estado = useComboboxBuscador()

  // El nombre del elegido se resuelve aparte de la búsqueda: puede no estar en la página actual
  // de resultados (o el filtro venir de la URL al entrar).
  const { data: seleccionado } = useProfesor(value ?? 0)
  const { data, isFetching, isError } = useProfesores(
    { estado: 'ACTIVO', q: estado.q || undefined, pageSize: 10 },
    estado.abierto,
  )

  return (
    <Field label="Profesor" htmlFor={id}>
      <ComboboxBuscador
        id={id}
        estado={estado}
        valor={value}
        textoValor={seleccionado ? `${seleccionado.apellido}, ${seleccionado.nombre}` : null}
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
    </Field>
  )
}
