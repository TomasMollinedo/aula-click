'use client'

import { type ReactNode, useId } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarraFiltros, claseControlFiltro } from '@/components/ui/barra-filtros'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { Field, fieldErrorId } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { CampoFiltro } from '../errores-cuentas'
import type { FiltrosCuenta as Filtros } from '../filtros-cuenta'
import { useMateriasDeCuenta } from '../hooks/use-materias-de-cuenta'
import type { NombresDeFiltros } from '../hooks/use-nombres-de-filtros'
import { FiltroProfesor } from './FiltroProfesor'

// Radix no admite value="": un valor especial representa "todas las materias" (sin filtrar).
const TODAS_LAS_MATERIAS = '__TODAS__'

type FiltrosCuentaProps = {
  filtros: Filtros
  /** Los nombres de lo filtrado, para el profesor elegido y la materia que no esté en la lista. */
  nombres: Pick<NombresDeFiltros, 'materia' | 'profesor'>
  onCambiar: (cambios: Partial<Filtros>) => void
  onLimpiar: () => void
  /** Si hay algún filtro puesto (en la vista global, también el alumno). */
  puedeLimpiar: boolean
  /** El 400 de la API por campo (`interpretarErrorCuenta`): hoy, el período en "Hasta". */
  errores?: Partial<Record<CampoFiltro, string>>
  /** El 400 que no se pudo ubicar en un campo. */
  errorGeneral?: string | null
  /** El filtro por alumno de la vista global: va primero, en su propio campo. */
  renderAlumno?: (id: string) => ReactNode
}

/**
 * Los filtros de `cuentas`, en las dos vistas: período (cada extremo opcional), materia y profesor.
 * No guarda estado: muestra los de la URL y avisa cada cambio, que se aplica enseguida. No valida el
 * período: un "Hasta" anterior al "Desde" se manda igual y el error de la API sale junto al campo.
 *
 * Es una `BarraFiltros`: en pantallas anchas (`xl`) entran todos en una sola fila, con "Limpiar
 * filtros" al final; en las más angostas se reparten en columnas y el botón va en una fila propia.
 */
export function FiltrosCuenta({
  filtros,
  nombres,
  onCambiar,
  onLimpiar,
  puedeLimpiar,
  errores = {},
  errorGeneral,
  renderAlumno,
}: FiltrosCuentaProps) {
  const id = useId()
  const ids = {
    alumno: `${id}-alumno`,
    desde: `${id}-desde`,
    hasta: `${id}-hasta`,
    materia: `${id}-materia`,
    profesor: `${id}-profesor`,
  }
  const { materias, isLoading: cargandoMaterias } = useMateriasDeCuenta()
  // La materia de la URL puede no estar en la lista (no existe, o no entró en la página): se
  // muestra igual, para que el control diga qué se está filtrando.
  const materiaFueraDeLista =
    filtros.materiaId !== null &&
    !cargandoMaterias &&
    !materias.some((m) => m.id === filtros.materiaId)

  return (
    <div className="space-y-3">
      <BarraFiltros
        hayFiltros={puedeLimpiar}
        onLimpiar={onLimpiar}
        limpiarEnFila="xl"
        className={
          renderAlumno
            ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]'
            : 'sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]'
        }
      >
        {renderAlumno && (
          <Field label="Alumno" htmlFor={ids.alumno} error={errores.alumnoId}>
            {renderAlumno(ids.alumno)}
          </Field>
        )}

        <Field label="Desde" htmlFor={ids.desde} error={errores.desde}>
          <CalendarioFecha
            id={ids.desde}
            compacto
            value={filtros.desde ?? ''}
            onChange={(fecha) => onCambiar({ desde: fecha || null })}
            placeholder="Sin fecha"
            textoVaciar="Sin fecha de inicio"
            aria-invalid={errores.desde ? true : undefined}
            aria-describedby={errores.desde ? fieldErrorId(ids.desde) : undefined}
          />
        </Field>

        <Field label="Hasta" htmlFor={ids.hasta} error={errores.hasta}>
          <CalendarioFecha
            id={ids.hasta}
            compacto
            value={filtros.hasta ?? ''}
            onChange={(fecha) => onCambiar({ hasta: fecha || null })}
            placeholder="Sin fecha"
            textoVaciar="Sin fecha de fin"
            aria-invalid={errores.hasta ? true : undefined}
            aria-describedby={errores.hasta ? fieldErrorId(ids.hasta) : undefined}
          />
        </Field>

        <Field label="Materia" htmlFor={ids.materia} error={errores.materiaId}>
          <Select
            value={filtros.materiaId === null ? TODAS_LAS_MATERIAS : String(filtros.materiaId)}
            onValueChange={(valor) =>
              onCambiar({ materiaId: valor === TODAS_LAS_MATERIAS ? null : Number(valor) })
            }
            disabled={cargandoMaterias}
          >
            <SelectTrigger
              id={ids.materia}
              className={claseControlFiltro(filtros.materiaId === null)}
            >
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS_LAS_MATERIAS}>Todas</SelectItem>
              {materiaFueraDeLista && filtros.materiaId !== null && (
                <SelectItem value={String(filtros.materiaId)}>
                  {nombres.materia ?? 'Materia no disponible'}
                </SelectItem>
              )}
              {materias.map((materia) => (
                <SelectItem key={materia.id} value={String(materia.id)}>
                  {materia.nombre}
                  {materia.inactiva && ' (dada de baja)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Profesor" htmlFor={ids.profesor} error={errores.profesorId}>
          <FiltroProfesor
            id={ids.profesor}
            value={filtros.profesorId}
            nombre={nombres.profesor}
            onChange={(profesorId) => onCambiar({ profesorId })}
          />
        </Field>
      </BarraFiltros>

      {errorGeneral && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">{errorGeneral}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
