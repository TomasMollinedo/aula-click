'use client'

import { AlertCircle, CalendarSearch, Check, DoorOpen, Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'
import type { ApiError } from '@/utils/fetch-json'
import { fechaConDia } from '@/utils/formato-fechas'

import { textoHorario } from '../formato-turnos'
import type { BloqueOfertado, MateriaOfertada } from '../mis-turnos.types'
import { claveBloqueOfertado, diasDe, profesoresDe } from '../sacar-turno'

// Búsqueda de "Sacar turno" en el portal: los mismos pasos que el alta de la mesa (filtros,
// resultados y horas), con lo que ve el alumno: las materias que la API le ofrece, los profesores y
// días que salen de esos horarios, y cada hora como "Disponible" o "Completo", sin cupos.

// Radix no admite value="": un valor especial representa "cualquiera".
const TODOS = '__TODOS__'

/** Una consulta de la pantalla, con lo que necesitan los estados de carga, vacío y error. */
export type Consulta<T> = {
  data: T | undefined
  isLoading: boolean
  error: ApiError | null
  refetch: () => unknown
}

/** Error de una consulta del portal: 403, materia inactiva o inexistente, o reintentar. */
function ErrorConsulta({
  error,
  onReintentar,
  queSeCargaba,
}: {
  error: ApiError
  onReintentar: () => void
  /** "las materias", "los horarios"… */
  queSeCargaba: string
}) {
  if (error.code === 'MATERIA_INACTIVA') {
    return (
      <Alert>
        <Info className="size-4" />
        <AlertDescription>{error.message}. Elegí otra materia.</AlertDescription>
      </Alert>
    )
  }
  const mensaje =
    error.status === 403
      ? 'No tenés permiso para sacar turnos.'
      : error.status === 404
        ? 'La materia ya no existe. Elegí otra.'
        : error.status === 400
          ? error.message
          : `No se pudieron cargar ${queSeCargaba}.`
  const sePuedeReintentar = error.status !== 403 && error.status !== 404 && error.status !== 400
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="text-destructive space-y-3">
        <p>{mensaje}</p>
        {sePuedeReintentar && (
          <Button variant="outline" size="sm" onClick={onReintentar}>
            Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// ---------------------------------------------------------------------------------------------
// Paso 1: materia, día y profesor
// ---------------------------------------------------------------------------------------------

export type MisFiltros = {
  materiaId: number | null
  profesorId: number | null
  diaSemana: number | null
}

export const MIS_FILTROS_VACIOS: MisFiltros = {
  materiaId: null,
  profesorId: null,
  diaSemana: null,
}

type FiltrosMiBusquedaProps = {
  materias: Consulta<MateriaOfertada[]>
  /**
   * Los horarios de la materia sin filtrar: de ahí salen el profesor y el día que se ofrecen. El
   * alumno no lista profesores (no tiene permiso): sólo los de los horarios de su materia.
   */
  horariosMateria: Consulta<BloqueOfertado[]>
  filtros: MisFiltros
  onCambio: (filtros: MisFiltros) => void
}

/** Materia (obligatoria), día y profesor (opcionales y combinables), como en el alta de la mesa. */
export function FiltrosMiBusqueda({
  materias,
  horariosMateria,
  filtros,
  onCambio,
}: FiltrosMiBusquedaProps) {
  const horarios = horariosMateria.data ?? []
  const profesores = profesoresDe(horarios)
  // Con un profesor elegido, sólo sus días.
  const dias = diasDe(
    filtros.profesorId === null
      ? horarios
      : horarios.filter((bloque) => bloque.profesor.id === filtros.profesorId),
  )
  const sinMateria = filtros.materiaId === null
  const cargandoHorarios = !sinMateria && horariosMateria.isLoading

  return (
    <div className="space-y-4">
      {materias.error && (
        <ErrorConsulta
          error={materias.error}
          onReintentar={() => void materias.refetch()}
          queSeCargaba="las materias"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Materia" htmlFor="mi-filtro-materia" required>
          <Select
            value={filtros.materiaId === null ? '' : String(filtros.materiaId)}
            onValueChange={(v) =>
              onCambio({ materiaId: Number(v), profesorId: null, diaSemana: null })
            }
            disabled={materias.isLoading || materias.error !== null}
          >
            <SelectTrigger id="mi-filtro-materia" className="h-11 w-full" aria-required>
              <SelectValue
                placeholder={
                  materias.isLoading
                    ? 'Cargando materias…'
                    : materias.error
                      ? 'No se pudieron cargar las materias'
                      : 'Elegí una materia'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {materias.data?.map((materia) => (
                <SelectItem key={materia.id} value={String(materia.id)}>
                  {materia.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {materias.data?.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Por ahora no hay clases para reservar. Consultá en la mesa de entrada.
            </p>
          )}
        </Field>

        <Field label="Día" htmlFor="mi-filtro-dia" optional>
          <Select
            value={filtros.diaSemana === null ? TODOS : String(filtros.diaSemana)}
            onValueChange={(v) =>
              onCambio({ ...filtros, diaSemana: v === TODOS ? null : Number(v) })
            }
            disabled={sinMateria || cargandoHorarios}
          >
            <SelectTrigger id="mi-filtro-dia" className="h-11 w-full">
              <SelectValue placeholder={sinMateria ? 'Elegí primero la materia' : 'Cargando…'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Cualquier día</SelectItem>
              {dias.map((dia) => (
                <SelectItem key={dia} value={String(dia)}>
                  {nombreDiaSemana(dia)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Profesor" htmlFor="mi-filtro-profesor" optional>
          <Select
            value={filtros.profesorId === null ? TODOS : String(filtros.profesorId)}
            onValueChange={(v) => {
              const profesorId = v === TODOS ? null : Number(v)
              // Un día que el profesor nuevo no tiene vuelve a "Cualquier día".
              const suyos = diasDe(
                profesorId === null
                  ? horarios
                  : horarios.filter((b) => b.profesor.id === profesorId),
              )
              onCambio({
                ...filtros,
                profesorId,
                diaSemana:
                  filtros.diaSemana !== null && suyos.includes(filtros.diaSemana)
                    ? filtros.diaSemana
                    : null,
              })
            }}
            disabled={sinMateria || cargandoHorarios}
          >
            <SelectTrigger id="mi-filtro-profesor" className="h-11 w-full">
              <SelectValue placeholder={sinMateria ? 'Elegí primero la materia' : 'Cargando…'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Cualquier profesor</SelectItem>
              {profesores.map((profesor) => (
                <SelectItem key={profesor.id} value={String(profesor.id)}>
                  {profesor.nombre} {profesor.apellido}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Paso 1 (resultados): los horarios
// ---------------------------------------------------------------------------------------------

type MisResultadosProps = {
  horarios: Consulta<BloqueOfertado[]>
  /** `claveBloqueOfertado` del horario elegido, o `null`. */
  claveElegida: string | null
  onElegir: (bloque: BloqueOfertado) => void
  /** Hay profesor o día elegidos: el vacío sugiere quitarlos. */
  hayFiltrosOpcionales: boolean
}

/** Cada horario con su profesor, día, horario completo y aula. Elegir uno muestra sus horas. */
export function MisResultadosDisponibilidad({
  horarios,
  claveElegida,
  onElegir,
  hayFiltrosOpcionales,
}: MisResultadosProps) {
  if (horarios.error) {
    return (
      <ErrorConsulta
        error={horarios.error}
        onReintentar={() => void horarios.refetch()}
        queSeCargaba="los horarios"
      />
    )
  }

  if (horarios.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy>
        <span className="sr-only">Cargando horarios…</span>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!horarios.data) return null

  if (horarios.data.length === 0) {
    return (
      <EmptyState
        icon={CalendarSearch}
        title="No hay horarios para esa búsqueda"
        description={
          hayFiltrosOpcionales
            ? 'Probá con cualquier profesor o cualquier día.'
            : 'Esta materia no tiene horarios para reservar. Elegí otra.'
        }
        className="py-10"
      />
    )
  }

  return (
    <ul aria-label="Horarios disponibles" className="grid gap-3 sm:grid-cols-2">
      {horarios.data.map((bloque) => {
        const clave = claveBloqueOfertado(bloque)
        const elegido = clave === claveElegida
        return (
          <li key={`${bloque.profesor.id}-${clave}`}>
            <button
              type="button"
              onClick={() => onElegir(bloque)}
              aria-pressed={elegido}
              className={cn(
                'focus-visible:ring-ring flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2',
                elegido
                  ? 'border-cobalto bg-cobalto/5'
                  : 'border-border hover:bg-canvas hover:border-cobalto/40',
              )}
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block font-medium">
                  {bloque.profesor.nombre} {bloque.profesor.apellido}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {nombreDiaSemana(bloque.diaSemana)}{' '}
                  {textoHorario(bloque.horaInicio, bloque.horaFin)}
                </span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5">
                    <DoorOpen className="size-3.5" aria-hidden />
                    {bloque.aula.nombre}
                  </span>
                  <span>Próxima clase: {fechaConDia(bloque.fecha)}</span>
                </span>
              </span>
              {elegido && <Check className="text-cobalto size-5 shrink-0" aria-hidden />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------------------------
// Paso 2: las horas del horario elegido
// ---------------------------------------------------------------------------------------------

type MisHorasProps = {
  bloque: BloqueOfertado
  tildadas: readonly number[]
  onCambio: (tildadas: number[]) => void
  /** No se puede tildar (se está reservando). */
  deshabilitado?: boolean
  /** Error de la API sobre las horas (`bloqueIds`). */
  error?: string
}

/**
 * Las horas del horario elegido, cada una con su checkbox y "Disponible" o "Completo" (lo decide la
 * API; el alumno no ve cuántos lugares hay). Una hora completa no se puede tildar.
 */
export function MisHorasDelBloque({
  bloque,
  tildadas,
  onCambio,
  deshabilitado = false,
  error,
}: MisHorasProps) {
  const alternar = (bloqueId: number, tildar: boolean) =>
    onCambio(tildar ? [...tildadas, bloqueId] : tildadas.filter((id) => id !== bloqueId))

  return (
    <div className="space-y-3">
      <fieldset
        aria-describedby={error ? 'mis-horas-error' : undefined}
        className={cn(deshabilitado && 'opacity-50')}
        disabled={deshabilitado}
      >
        <legend className="sr-only">Horas del horario elegido</legend>
        <ul className="divide-border border-border divide-y rounded-lg border">
          {bloque.horas.map((hora) => {
            const id = `mi-hora-${hora.bloqueId}`
            const tildada = tildadas.includes(hora.bloqueId)
            const noSePuede = !hora.disponible || deshabilitado
            return (
              <li
                key={hora.bloqueId}
                className={cn(
                  'flex min-h-14 items-center gap-3 px-4 py-3',
                  !hora.disponible && 'bg-canvas',
                )}
              >
                <Checkbox
                  id={id}
                  checked={tildada}
                  onCheckedChange={(v) => alternar(hora.bloqueId, v === true)}
                  disabled={noSePuede}
                  aria-disabled={noSePuede || undefined}
                  aria-describedby={!hora.disponible ? `${id}-completa` : undefined}
                />
                <label
                  htmlFor={id}
                  className={cn(
                    'flex min-w-0 flex-1 items-center text-sm',
                    hora.disponible ? 'cursor-pointer' : 'text-muted-foreground cursor-not-allowed',
                  )}
                >
                  <span className="font-medium">{textoHorario(hora.horaInicio, hora.horaFin)}</span>
                </label>
                {hora.disponible ? (
                  <span className="text-confirmado text-xs font-medium">Disponible</span>
                ) : (
                  <Badge variant="cancelado" id={`${id}-completa`}>
                    Completo
                    <span className="sr-only">: no se puede elegir</span>
                  </Badge>
                )}
              </li>
            )
          })}
        </ul>
      </fieldset>

      {error && (
        <p id="mis-horas-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
