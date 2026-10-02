'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CalendarX2 } from 'lucide-react'

import { EstadoPagoBadge } from '@/components/turno/estado-pago-badge'
import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'
import { cn } from '@/utils/cn'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import { useDetalleEnUrl } from '../hooks/use-detalle-en-url'
import { useOcurrenciasDelAlumno } from '../hooks/use-ocurrencias-del-alumno'

const COLUMNAS = 7

/** Clave de una ocurrencia en la selección: `turnoId` se repite entre fechas de un recurrente. */
function clave(o: OcurrenciaDeAlumno): string {
  return `${o.turnoId}|${o.fecha}`
}

/** `YYYY-MM-DD` de hoy más `dias` (puede ser negativo). */
function fechaMasDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export type TurnosDelAlumnoProps = {
  alumnoId: number
  /**
   * Acciones sobre los turnos tildados (cancelar varios). Las compone `app/`: recibe lo que
   * necesita `AccionCancelarVarios`. `onListo` limpia la selección.
   */
  renderAccionesSeleccion: (seleccion: {
    alumnoId: number
    ocurrencias: OcurrenciaDeAlumno[]
    onListo: () => void
  }) => ReactNode
  /**
   * "Generar PDF" de los turnos ya filtrados (no es de ningún ticket, se agregó aparte de T-60).
   * Recibe el mismo rango que se está viendo, para que el PDF coincida con la pantalla.
   */
  renderPdf?: (seleccion: { alumnoId: number; desde: string; hasta: string }) => ReactNode
}

/**
 * Pestaña "Turnos" de la ficha del alumno (HU-02): sus ocurrencias, con casilla de selección en
 * las `cancelable` (lo decide la API: una pagada no se puede tildar), clic para abrir el detalle y
 * un rango de fechas elegible (por defecto, 30 días atrás y 8 semanas adelante). El estado de pago
 * es el de la API; en una cancelada no se muestra.
 */
export function TurnosDelAlumno({
  alumnoId,
  renderAccionesSeleccion,
  renderPdf,
}: TurnosDelAlumnoProps) {
  const [desde, setDesde] = useState(() => fechaMasDias(-30))
  const [hasta, setHasta] = useState(() => fechaMasDias(56))
  const rangoInvertido = hasta < desde

  const { data, isLoading, isError, error, refetch } = useOcurrenciasDelAlumno(
    { alumnoId, desde, hasta },
    { enabled: !rangoInvertido },
  )
  const { hrefDetalle, marcarAbiertoConLink } = useDetalleEnUrl()
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const cancelables = useMemo(() => (data ?? []).filter((o) => o.cancelable), [data])
  const todasTildadas = cancelables.length > 0 && seleccion.size === cancelables.length

  const ocurrenciasSeleccionadas = useMemo(
    () => cancelables.filter((o) => seleccion.has(clave(o))),
    [cancelables, seleccion],
  )

  function alternar(o: OcurrenciaDeAlumno) {
    setSeleccion((anterior) => {
      const nuevo = new Set(anterior)
      const k = clave(o)
      if (nuevo.has(k)) nuevo.delete(k)
      else nuevo.add(k)
      return nuevo
    })
  }

  function alternarTodas() {
    setSeleccion(todasTildadas ? new Set() : new Set(cancelables.map(clave)))
  }

  function abrirDetalle(o: OcurrenciaDeAlumno) {
    marcarAbiertoConLink()
    router.push(hrefDetalle(o.turnoId, o.fecha), { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value)
              setSeleccion(new Set())
            }}
            aria-label="Desde"
            className="h-9 w-40"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value)
              setSeleccion(new Set())
            }}
            aria-label="Hasta"
            className="h-9 w-40"
          />
          {cancelables.length > 0 && (
            <Button variant="outline" size="sm" onClick={alternarTodas}>
              {todasTildadas ? 'Quitar selección' : 'Seleccionar todos'}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {cancelables.length > 0 &&
            renderAccionesSeleccion({
              alumnoId,
              ocurrencias: ocurrenciasSeleccionadas,
              onListo: () => setSeleccion(new Set()),
            })}
          {data && data.length > 0 && renderPdf?.({ alumnoId, desde, hasta })}
        </div>
      </div>

      {rangoInvertido ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            “Hasta” tiene que ser posterior a “Desde”.
          </AlertDescription>
        </Alert>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {error?.status === 403
              ? 'No tenés permiso para ver los turnos de este alumno'
              : (error?.message ?? 'Ocurrió un error inesperado')}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-32">Horario</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead>Profesor</TableHead>
                <TableHead className="w-32">Estado</TableHead>
                <TableHead className="w-28">Pago</TableHead>
                <TableHead className="w-40">Prioridad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={COLUMNAS + 1}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.length > 0 ? (
                data.map((turno) => (
                  <TableRow
                    key={clave(turno)}
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return
                      abrirDetalle(turno)
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {turno.cancelable && (
                        <Checkbox
                          checked={seleccion.has(clave(turno))}
                          onCheckedChange={() => alternar(turno)}
                          aria-label={`Seleccionar el turno del ${fechaConDia(turno.fecha)}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fechaConDia(turno.fecha)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {rangoHoras(turno.horaInicio, turno.horaFin)}
                    </TableCell>
                    <TableCell className="font-medium">{turno.materia.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {turno.profesor.nombre} {turno.profesor.apellido}
                    </TableCell>
                    <TableCell>
                      <EstadoTurnoBadge estado={turno.estado} />
                    </TableCell>
                    <TableCell>
                      {/* Una cancelada nunca se cobró (la API manda PENDIENTE): "Pendiente" confundiría. */}
                      {turno.estado === 'CANCELADO' ? (
                        <span
                          className="text-muted-foreground"
                          aria-label="Sin pago: turno cancelado"
                        >
                          —
                        </span>
                      ) : (
                        <EstadoPagoBadge estado={turno.estadoPago} />
                      )}
                    </TableCell>
                    <TableCell>
                      {turno.prioridad && (
                        <PrioridadIndicador prioridad={turno.prioridad} variante="fila" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className={cn('hover:bg-transparent')}>
                  <TableCell colSpan={COLUMNAS + 1} className="p-0">
                    <EmptyState
                      icon={CalendarX2}
                      title="Sin turnos"
                      description="Este alumno no tiene turnos en el rango elegido."
                      className="py-16"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
