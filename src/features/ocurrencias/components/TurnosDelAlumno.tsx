'use client'

import { type ReactNode, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CalendarX2 } from 'lucide-react'

import { EstadoPagoBadge } from '@/components/turno/estado-pago-badge'
import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { ESTADO_TURNO, type EstadoTurno } from '@/components/turno/indicadores-turno'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarraFiltros, claseControlFiltro } from '@/components/ui/barra-filtros'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import {
  MESES_DEL_ANIO,
  TODO_EL_ANIO,
  type FiltroMes,
  nombreDelMes,
  rangoDelFiltro,
} from '../meses-del-anio'

const COLUMNAS = 7
const TODOS_LOS_ESTADOS = 'TODOS'
type FiltroEstado = typeof TODOS_LOS_ESTADOS | EstadoTurno

/** Clave de una ocurrencia en la selección: `turnoId` se repite entre fechas de un recurrente. */
function clave(o: OcurrenciaDeAlumno): string {
  return `${o.turnoId}|${o.fecha}`
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
   * "Generar PDF" de los turnos ya filtrados (no es de ningún ticket, se agregó aparte de T-60;
   * T-67 le sumó el estado y la selección tildada). Con turnos tildados, el PDF es sólo esos; si
   * no, es todo lo que se ve en pantalla (mes + estado).
   */
  renderPdf?: (seleccion: {
    alumnoId: number
    desde: string
    hasta: string
    estado: EstadoTurno | null
    seleccionadas: OcurrenciaDeAlumno[]
  }) => ReactNode
}

/**
 * Pestaña "Turnos" de la ficha del alumno (HU-02): sus ocurrencias, con casilla de selección en
 * las `cancelable` (lo decide la API: una pagada no se puede tildar), clic para abrir el detalle, un
 * mes del año en curso a elegir (o todo el año, T-66/T-67) y un filtro por estado, en una
 * `BarraFiltros` ("Limpiar filtros" vuelve al mes en curso y a todos los estados). El estado de pago
 * es el de la API; en una cancelada no se muestra.
 */
export function TurnosDelAlumno({
  alumnoId,
  renderAccionesSeleccion,
  renderPdf,
}: TurnosDelAlumnoProps) {
  const id = useId()
  const ids = { mes: `${id}-mes`, estado: `${id}-estado` }
  const anio = useMemo(() => new Date().getFullYear(), [])
  // El mes en curso es el filtro por defecto: es al que vuelve "Limpiar filtros".
  const mesActual = useMemo(() => new Date().getMonth(), [])
  const [mes, setMes] = useState<FiltroMes>(mesActual)
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>(TODOS_LOS_ESTADOS)
  const { desde, hasta } = rangoDelFiltro(anio, mes)

  const { data, isLoading, isError, error, refetch } = useOcurrenciasDelAlumno({
    alumnoId,
    desde,
    hasta,
  })
  const datosFiltrados = useMemo(
    () =>
      (data ?? []).filter((o) => estadoFiltro === TODOS_LOS_ESTADOS || o.estado === estadoFiltro),
    [data, estadoFiltro],
  )
  const { hrefDetalle, marcarAbiertoConLink } = useDetalleEnUrl()
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const cancelables = useMemo(() => datosFiltrados.filter((o) => o.cancelable), [datosFiltrados])
  const todasTildadas = cancelables.length > 0 && seleccion.size === cancelables.length

  const ocurrenciasSeleccionadas = useMemo(
    () => cancelables.filter((o) => seleccion.has(clave(o))),
    [cancelables, seleccion],
  )

  function cambiarMes(valor: string) {
    setMes(valor === TODO_EL_ANIO ? TODO_EL_ANIO : Number(valor))
    setSeleccion(new Set())
  }

  function cambiarEstado(valor: string) {
    setEstadoFiltro(valor === TODOS_LOS_ESTADOS ? TODOS_LOS_ESTADOS : (valor as EstadoTurno))
    setSeleccion(new Set())
  }

  function limpiarFiltros() {
    setMes(mesActual)
    setEstadoFiltro(TODOS_LOS_ESTADOS)
    setSeleccion(new Set())
  }

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
      <Card>
        <BarraFiltros
          hayFiltros={mes !== mesActual || estadoFiltro !== TODOS_LOS_ESTADOS}
          onLimpiar={limpiarFiltros}
          limpiarEnFila="md"
          className="sm:grid-cols-2 md:grid-cols-[repeat(2,minmax(0,16rem))_1fr]"
        >
          <Field label="Mes" htmlFor={ids.mes}>
            <Select value={String(mes)} onValueChange={cambiarMes}>
              <SelectTrigger id={ids.mes} className={claseControlFiltro(false)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODO_EL_ANIO}>Todo el año</SelectItem>
                {MESES_DEL_ANIO.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {nombreDelMes(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado" htmlFor={ids.estado}>
            <Select value={estadoFiltro} onValueChange={cambiarEstado}>
              <SelectTrigger
                id={ids.estado}
                className={claseControlFiltro(estadoFiltro === TODOS_LOS_ESTADOS)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_LOS_ESTADOS}>Todos</SelectItem>
                {(Object.keys(ESTADO_TURNO) as EstadoTurno[]).map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {ESTADO_TURNO[estado].etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </BarraFiltros>
      </Card>

      {datosFiltrados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
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
            {renderPdf?.({
              alumnoId,
              desde,
              hasta,
              estado: estadoFiltro === TODOS_LOS_ESTADOS ? null : estadoFiltro,
              seleccionadas: ocurrenciasSeleccionadas,
            })}
          </div>
        </div>
      )}

      {isError ? (
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
              ) : datosFiltrados.length > 0 ? (
                datosFiltrados.map((turno) => (
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
                      description="Este alumno no tiene turnos en el período elegido."
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
