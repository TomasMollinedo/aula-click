'use client'

import { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronLeft, ChevronRight, HandCoins, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarraFiltros, claseControlFiltro } from '@/components/ui/barra-filtros'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { PaginationControls } from '@/components/ui/pagination'
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/utils/cn'
import type { ApiError } from '@/utils/fetch-json'
import { textoMes } from '@/utils/formato-fechas'
import { formatearPesos } from '@/utils/moneda'

import { nombreDeProfesor, TEXTO_ESTADO_FILTRO } from '../formato-liquidaciones'
import { useLiquidacionesDelMes } from '../hooks/use-liquidaciones-del-mes'
import { useMesLiquidacionEnUrl } from '../hooks/use-mes-liquidacion-en-url'
import {
  ESTADOS_LIQUIDACION,
  type EstadoLiquidacion,
  type LiquidacionesDelMes as Listado,
  type TotalesLiquidacion,
} from '../liquidaciones.types'
import { mesAnterior, mesSiguiente } from '../mes-liquidacion'
import { EstadoLiquidacionBadge } from './EstadoLiquidacionBadge'
import { FiltroProfesorDeLiquidaciones } from './FiltroProfesorDeLiquidaciones'

export type LiquidacionesDelMesProps = {
  /**
   * URL del listado en el segmento (`/gerente/liquidaciones`); el detalle de una liquidación es
   * `${rutaBase}/${profesorId}/${mes}`.
   */
  rutaBase: string
}

const EN_CURSO = { estado: 'EN_CURSO', fechaTransferencia: null, descontadaEnMes: null } as const

// Importes a la derecha, con cifras del mismo ancho y sin cortarse.
const IMPORTE = 'text-right tabular-nums whitespace-nowrap'

/**
 * Listado de liquidaciones del mes (HU-44), en `/gerente/liquidaciones`: el mes va en la URL
 * (`?mes=`; sin él, el último terminado, que decide la API) y se recorre con las flechas. Todo se
 * rotula con el `mes` de la respuesta, no con el pedido: mientras llega el mes nuevo se ve el
 * anterior atenuado. Se puede filtrar por profesor (`?profesorId=`, con un buscador) y por estado
 * (`?estado=`), y los dos se combinan. Los totales son de todo lo que devuelve el filtro, no de la
 * página.
 */
export function LiquidacionesDelMes({ rutaBase }: LiquidacionesDelMesProps) {
  const {
    mes,
    profesorId,
    estado,
    page,
    mesEnCurso,
    elegirMes,
    elegirProfesor,
    elegirEstado,
    limpiarFiltros,
    cambiarPagina,
  } = useMesLiquidacionEnUrl()
  const id = useId()
  const query = useLiquidacionesDelMes({ mes, profesorId, estado, page })
  const { data } = query

  // Página fuera de rango (una URL vieja): pasa a la última que exista.
  const totalPages = query.isPlaceholderData ? undefined : data?.meta.totalPages
  const corregir = useRef(cambiarPagina)
  useEffect(() => {
    corregir.current = cambiarPagina
  })
  useEffect(() => {
    if (totalPages === undefined) return
    const ultima = Math.max(1, totalPages)
    if (page > ultima) corregir.current(ultima)
  }, [totalPages, page])

  const hayFiltros = profesorId !== undefined || estado !== undefined

  // Las flechas parten del mes pedido; sin mes en la URL, del que devolvió la API.
  const base = mes ?? data?.mes

  return (
    <div className="space-y-6">
      {!query.isError && (
        <div className="space-y-4">
          <SelectorMes
            mes={data?.mes}
            enCurso={data?.mes === mesEnCurso}
            onAnterior={base ? () => elegirMes(mesAnterior(base)) : undefined}
            onSiguiente={
              base && base < mesEnCurso ? () => elegirMes(mesSiguiente(base)) : undefined
            }
          />
          <BarraFiltros
            hayFiltros={hayFiltros}
            onLimpiar={limpiarFiltros}
            limpiarEnFila="lg"
            className="sm:grid-cols-2 lg:grid-cols-[minmax(0,18rem)_minmax(0,14rem)_auto]"
          >
            <Field label="Profesor" htmlFor={`${id}-profesor`}>
              <FiltroProfesorDeLiquidaciones
                id={`${id}-profesor`}
                value={profesorId ?? null}
                onChange={elegirProfesor}
              />
            </Field>
            <Field label="Estado" htmlFor={`${id}-estado`}>
              <FiltroEstado id={`${id}-estado`} value={estado ?? null} onChange={elegirEstado} />
            </Field>
          </BarraFiltros>
        </div>
      )}

      {query.isError ? (
        <ErrorListado
          error={query.error}
          rutaBase={rutaBase}
          onReintentar={() => query.refetch()}
        />
      ) : data ? (
        <div
          aria-busy={query.isPlaceholderData}
          className={cn(
            'transition-opacity',
            query.isPlaceholderData && 'pointer-events-none opacity-50',
          )}
        >
          <TablaLiquidaciones
            listado={data}
            rutaBase={rutaBase}
            conFiltro={hayFiltros}
            onPageChange={cambiarPagina}
          />
        </div>
      ) : (
        <Card className="p-6" role="status" aria-label="Cargando las liquidaciones">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Card>
      )}
    </div>
  )
}

// Radix Select no admite un valor vacío: "sin filtro" es este valor y se traduce a `null`.
const TODOS = 'TODOS'

function FiltroEstado({
  id,
  value,
  onChange,
}: {
  id: string
  value: EstadoLiquidacion | null
  onChange: (valor: EstadoLiquidacion | null) => void
}) {
  return (
    <Select
      value={value ?? TODOS}
      onValueChange={(valor) => onChange(valor === TODOS ? null : (valor as EstadoLiquidacion))}
    >
      <SelectTrigger id={id} className={claseControlFiltro(value === null)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos los estados</SelectItem>
        {ESTADOS_LIQUIDACION.map((estado) => (
          <SelectItem key={estado} value={estado}>
            {TEXTO_ESTADO_FILTRO[estado]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SelectorMes({
  mes,
  enCurso,
  onAnterior,
  onSiguiente,
}: {
  /** El mes de la respuesta; sin respuesta todavía, un esqueleto. */
  mes: string | undefined
  enCurso: boolean
  /** Sin callback, la flecha queda deshabilitada. */
  onAnterior?: () => void
  onSiguiente?: () => void
}) {
  return (
    <div role="group" aria-label="Mes" className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes anterior"
        disabled={!onAnterior}
        onClick={onAnterior}
      >
        <ChevronLeft />
      </Button>
      <div className="flex min-w-48 items-center justify-center gap-2">
        {mes ? (
          <>
            <h2 aria-live="polite" className="text-lg font-semibold first-letter:uppercase">
              {textoMes(mes)}
            </h2>
            {enCurso && <EstadoLiquidacionBadge liquidacion={EN_CURSO} />}
          </>
        ) : (
          <Skeleton className="h-6 w-36" />
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mes siguiente"
        disabled={!onSiguiente}
        onClick={onSiguiente}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

function TablaLiquidaciones({
  listado,
  rutaBase,
  conFiltro,
  onPageChange,
}: {
  listado: Listado
  rutaBase: string
  /** Si el listado está filtrado: cambia el vacío y el rótulo del total. */
  conFiltro: boolean
  onPageChange: (page: number) => void
}) {
  const { mes, data: filas, totales, meta } = listado

  if (meta.total === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={HandCoins}
          title={`No hay liquidaciones en ${textoMes(mes)}`}
          description={
            conFiltro ? 'Ninguna liquidación del mes coincide con los filtros.' : undefined
          }
        />
      </Card>
    )
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Profesor</TableHead>
            <TableHead className="text-right">Turnos</TableHead>
            <TableHead className="text-right whitespace-nowrap">Total cobrado</TableHead>
            <TableHead className="text-right whitespace-nowrap">Parte del centro</TableHead>
            <TableHead className="text-right whitespace-nowrap">Parte del profesor</TableHead>
            <TableHead className="text-right">Ajustes</TableHead>
            <TableHead className="text-right whitespace-nowrap">Total a pagar</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={fila.profesor.id}>
              <TableCell className="whitespace-nowrap">
                <Link
                  href={`${rutaBase}/${fila.profesor.id}/${mes}`}
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  {nombreDeProfesor(fila.profesor)}
                </Link>
              </TableCell>
              <Importes totales={fila} />
              <TableCell className="whitespace-nowrap">
                <EstadoLiquidacionBadge liquidacion={fila} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell className="font-semibold whitespace-nowrap">
              {conFiltro ? 'Total filtrado' : 'Total del mes'}
            </TableCell>
            <Importes totales={totales} />
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      {meta.totalPages > 1 && (
        <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Mostrando {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}{' '}
            {meta.total === 1 ? 'profesor' : 'profesores'}
          </p>
          <PaginationControls
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </Card>
  )
}

/**
 * Las columnas de turnos e importes, iguales en cada fila y en el total del mes. Cada importe se
 * ve según lo que le importa al gerente: el total a pagar (lo que transfiere) es lo más grande y
 * pasa a rojo si no hay nada a favor del profesor; la parte del centro (lo que gana) va en verde;
 * los ajustes son una alerta, en rojo si descuentan y apagados si son $ 0; y el total cobrado y la
 * parte del profesor son contexto, sin énfasis.
 */
function Importes({ totales }: { totales: TotalesLiquidacion }) {
  return (
    <>
      <TableCell className={IMPORTE}>{totales.cantidadTurnos}</TableCell>
      <TableCell className={cn(IMPORTE, 'text-muted-foreground')}>
        {formatearPesos(totales.totalCobrado)}
      </TableCell>
      <TableCell className={cn(IMPORTE, 'text-confirmado font-semibold')}>
        {formatearPesos(totales.parteCentro)}
      </TableCell>
      <TableCell className={IMPORTE}>{formatearPesos(totales.parteProfesor)}</TableCell>
      <TableCell
        className={cn(
          IMPORTE,
          totales.totalAjustes < 0 ? 'text-cancelado font-semibold' : 'text-muted-foreground/60',
        )}
      >
        {formatearPesos(totales.totalAjustes)}
      </TableCell>
      <TableCell
        className={cn(IMPORTE, 'text-base font-bold', totales.total <= 0 && 'text-cancelado')}
      >
        {formatearPesos(totales.total)}
      </TableCell>
    </>
  )
}

/**
 * Errores de la lectura (docs/arquitectura-frontend.md → Manejo de errores en la UI): 400 (mes
 * futuro o inválido) con el `message` de la API y la vuelta al mes por defecto; 403 sin permiso;
 * cualquier otro (500, red), genérico con reintentar. El 401 lo resuelve `providers.tsx`.
 */
function ErrorListado({
  error,
  rutaBase,
  onReintentar,
}: {
  error: ApiError | null
  rutaBase: string
  onReintentar: () => void
}) {
  const status = error?.status
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
        {status === 400 ? (
          <>
            {error?.message}
            <Link href={rutaBase} className="font-medium underline underline-offset-4">
              Ver el último mes terminado
            </Link>
          </>
        ) : status === 403 ? (
          'No tenés permiso para ver las liquidaciones'
        ) : (
          <>
            No se pudieron cargar las liquidaciones. Revisá la conexión e intentá de nuevo.
            <Button type="button" size="sm" variant="outline" onClick={onReintentar}>
              <RotateCw />
              Reintentar
            </Button>
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}
