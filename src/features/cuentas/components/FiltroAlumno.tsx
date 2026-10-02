'use client'

import Link from 'next/link'

import { useAlumnos } from '@/features/alumnos/hooks/use-alumnos'

import { hrefFichaAlumno } from '../rutas-cuentas'
import { ComboboxBuscador, useComboboxBuscador } from './ComboboxBuscador'

type FiltroAlumnoProps = {
  id: string
  value: number | null
  /** El nombre del alumno filtrado (`useNombresDeFiltros`); `null` mientras carga. */
  nombre: string | null
  /** El alumno de la URL no existe: el control lo dice en vez de quedar cargando. */
  noEncontrado: boolean
  onChange: (value: number | null) => void
}

/**
 * Filtro por alumno de la vista global "Pagos": busca por DNI, nombre o apellido con el hook de
 * `alumnos` (hasta 10 por búsqueda, solo con el menú abierto). Sin alumno, una leyenda cuenta para
 * qué sirve elegirlo (con un alumno filtrado se pueden cobrar varios turnos juntos); con un alumno
 * elegido, ofrece ir a su cuenta. El filtro vive en la URL: lo escribe `PagosGlobal`.
 */
export function FiltroAlumno({ id, value, nombre, noEncontrado, onChange }: FiltroAlumnoProps) {
  const estado = useComboboxBuscador()
  const { data, isFetching, isError, error } = useAlumnos(
    { q: estado.q || undefined, pageSize: 10 },
    estado.abierto,
  )

  return (
    <div className="space-y-1.5">
      <ComboboxBuscador
        id={id}
        estado={estado}
        valor={value}
        textoValor={noEncontrado ? 'Alumno no encontrado' : nombre}
        textoTodos="Todos"
        placeholderBusqueda="Buscar por DNI, nombre o apellido…"
        textoSinResultados="No se encontraron alumnos."
        opciones={(data?.data ?? []).map((alumno) => ({
          id: alumno.id,
          etiqueta: `${alumno.apellido}, ${alumno.nombre}`,
          detalle: `DNI ${alumno.dni}`,
        }))}
        buscando={isFetching}
        error={
          isError
            ? error?.status === 403
              ? 'No tenés permiso para buscar alumnos.'
              : 'No se pudieron buscar los alumnos.'
            : null
        }
        onElegir={onChange}
        aria-invalid={noEncontrado || undefined}
      />
      {value === null ? (
        <p className="text-muted-foreground text-xs">
          Elegí un alumno para realizar varios pagos a la vez.
        </p>
      ) : (
        !noEncontrado && (
          <Link
            href={hrefFichaAlumno(value)}
            className="text-cobalto inline-block text-xs font-medium underline-offset-4 hover:underline"
          >
            Ver cuenta del alumno
          </Link>
        )
      )}
    </div>
  )
}
