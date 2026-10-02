'use client'

import { ComboboxBuscador, useComboboxBuscador } from '@/components/ui/combobox-buscador'

type Opcion = { id: number; nombre: string }

type SelectBuscableProps = {
  /** El `id` del botón, para el `htmlFor` del `Field` que lo rotula. */
  id: string
  /** Las opciones, ya cargadas: el buscador las filtra en el cliente. */
  opciones: readonly Opcion[]
  /** La opción elegida; `null` = sin filtro. Se muestra aunque no esté entre `opciones`. */
  value: Opcion | null
  onChange: (opcion: Opcion | null) => void
  /** La opción que quita el filtro y el texto del botón sin nada elegido ("Todas"). */
  textoTodas: string
  /** Para el buscador del menú y el lector de pantalla ("Buscar materia"). */
  etiquetaBusqueda: string
  textoVacio: string
}

/** Sin tildes ni mayúsculas, para que "nunez" encuentre a "Núñez". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Un selector con buscador para elegir una opción de una lista que ya está en el cliente: se abre,
 * se escribe para acotar (todas las palabras, en cualquier orden, sin tildes) y se elige. Es un
 * `ComboboxBuscador` con las opciones filtradas acá, en vez de pedidas al backend.
 */
export function SelectBuscable({
  id,
  opciones,
  value,
  onChange,
  textoTodas,
  etiquetaBusqueda,
  textoVacio,
}: SelectBuscableProps) {
  const estado = useComboboxBuscador()

  const terminos = normalizar(estado.texto).split(/\s+/).filter(Boolean)
  const visibles = opciones.filter((opcion) => {
    const nombre = normalizar(opcion.nombre)
    return terminos.every((termino) => nombre.includes(termino))
  })

  return (
    <ComboboxBuscador
      id={id}
      // La lista sale de lo escrito sin esperar al debounce: siempre es la de `texto`.
      estado={{ ...estado, q: estado.texto }}
      valor={value?.id ?? null}
      textoValor={value?.nombre ?? null}
      textoTodos={textoTodas}
      placeholderBusqueda={`${etiquetaBusqueda}…`}
      textoSinResultados={textoVacio}
      opciones={visibles.map((opcion) => ({ id: opcion.id, etiqueta: opcion.nombre }))}
      buscando={false}
      onElegir={(elegido) => onChange(opciones.find((opcion) => opcion.id === elegido) ?? null)}
    />
  )
}
