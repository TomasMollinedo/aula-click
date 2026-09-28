'use client'

import { AlertCircle, CalendarSearch, Check, DoorOpen, Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { nombreDiaSemana } from '@/utils/dias-semana'
import type { ApiError } from '@/utils/fetch-json'

import { textoHorario } from '../formato-turnos'
import { claveBloque } from '../seleccion-turno'
import type { BloqueDisponible } from '../turnos.types'

type ResultadosDisponibilidadProps = {
  resultados: BloqueDisponible[] | undefined
  isLoading: boolean
  /** La lista es la de los filtros anteriores mientras llega la nueva: atenuada y sin elegir. */
  isPlaceholderData: boolean
  error: ApiError | null
  onReintentar: () => void
  /** `claveBloque` del resultado elegido, o `null`. */
  claveElegida: string | null
  onElegir: (bloque: BloqueDisponible) => void
  /** Hay filtros opcionales puestos: el vacío sugiere quitarlos. */
  hayFiltrosOpcionales: boolean
}

/** Error de la búsqueda: `MATERIA_INACTIVA` es un aviso (se elige otra materia), no un error. */
function ErrorBusqueda({ error, onReintentar }: { error: ApiError; onReintentar: () => void }) {
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
      ? 'No tenés permiso para buscar horarios'
      : error.status === 404
        ? 'La materia no existe. Elegí otra.'
        : error.message
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
        {mensaje}
        {error.status !== 403 && error.status !== 404 && (
          <Button variant="outline" size="sm" onClick={onReintentar}>
            Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Paso 2 (resultados): cada bloque con profesor, día, horario completo y aula. Elegir uno muestra
 * sus horas (paso 3). La ocupación de cada hora la muestra el paso 3, no esta lista.
 */
export function ResultadosDisponibilidad({
  resultados,
  isLoading,
  isPlaceholderData,
  error,
  onReintentar,
  claveElegida,
  onElegir,
  hayFiltrosOpcionales,
}: ResultadosDisponibilidadProps) {
  if (error) return <ErrorBusqueda error={error} onReintentar={onReintentar} />

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!resultados) return null

  if (resultados.length === 0) {
    return (
      <EmptyState
        icon={CalendarSearch}
        title="No hay horarios para esos filtros"
        description={
          hayFiltrosOpcionales
            ? 'Probá quitando el día o el profesor.'
            : 'Ningún profesor activo tiene horarios cargados para esta materia.'
        }
        className="py-10"
      />
    )
  }

  return (
    <ul
      aria-label="Horarios disponibles"
      aria-busy={isPlaceholderData || undefined}
      className={cn('grid gap-3 sm:grid-cols-2', isPlaceholderData && 'opacity-50')}
    >
      {resultados.map((bloque) => {
        const clave = claveBloque(bloque)
        const elegido = clave === claveElegida
        return (
          <li key={`${bloque.profesor.id}-${clave}`}>
            <button
              type="button"
              onClick={() => onElegir(bloque)}
              disabled={isPlaceholderData}
              aria-pressed={elegido}
              className={cn(
                'focus-visible:ring-ring flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed',
                elegido
                  ? 'border-cobalto bg-cobalto/5'
                  : 'border-border hover:bg-canvas enabled:hover:border-cobalto/40',
              )}
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block font-medium">
                  {bloque.profesor.apellido}, {bloque.profesor.nombre}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {nombreDiaSemana(bloque.diaSemana)}{' '}
                  {textoHorario(bloque.horaInicio, bloque.horaFin)}
                </span>
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <DoorOpen className="size-3.5" aria-hidden />
                  {bloque.aula.nombre}
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
