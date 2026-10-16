'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronLeft, ChevronRight, HandCoins, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
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

import { nombreDeProfesor } from '../formato-liquidaciones'
import { useLiquidacionesDelMes } from '../hooks/use-liquidaciones-del-mes'
import { useMesLiquidacionEnUrl } from '../hooks/use-mes-liquidacion-en-url'
import type { LiquidacionesDelMes as Listado, TotalesLiquidacion } from '../liquidaciones.types'
import { mesAnterior, mesSiguiente } from '../mes-liquidacion'
import { EstadoLiquidacionBadge } from './EstadoLiquidacionBadge'

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
 * anterior atenuado. Los totales son de todo el mes, no de la página.
 */
export function LiquidacionesDelMes({ rutaBase }: LiquidacionesDelMesProps) {
  const { mes, page, mesEnCurso, elegirMes, cambiarPagina } = useMesLiquidacionEnUrl()
  const query = useLiquidacionesDelMes({ mes, page })
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

  // Las flechas parten del mes pedido; sin mes en la URL, del que devolvió la API.
  const base = mes ?? data?.mes

  return (
    <div className="space-y-6">
      {!query.isError && (
        <SelectorMes
          mes={data?.mes}
          enCurso={data?.mes === mesEnCurso}
          onAnterior={base ? () => elegirMes(mesAnterior(base)) : undefined}
          onSiguiente={base && base < mesEnCurso ? () => elegirMes(mesSiguiente(base)) : undefined}
        />
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
          <TablaLiquidaciones listado={data} rutaBase={rutaBase} onPageChange={cambiarPagina} />
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
  onPageChange,
}: {
  listado: Listado
  rutaBase: string
  onPageChange: (page: number) => void
}) {
  const { mes, data: filas, totales, meta } = listado

  if (meta.total === 0) {
    return (
      <Card className="p-0">
        <EmptyState icon={HandCoins} title={`No hay liquidaciones en ${textoMes(mes)}`} />
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
            <TableCell className="font-semibold whitespace-nowrap">Total del mes</TableCell>
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

/** Las columnas de turnos e importes, iguales en cada fila y en el total del mes. */
function Importes({ totales }: { totales: TotalesLiquidacion }) {
  return (
    <>
      <TableCell className={IMPORTE}>{totales.cantidadTurnos}</TableCell>
      <TableCell className={IMPORTE}>{formatearPesos(totales.totalCobrado)}</TableCell>
      <TableCell className={IMPORTE}>{formatearPesos(totales.parteCentro)}</TableCell>
      <TableCell className={IMPORTE}>{formatearPesos(totales.parteProfesor)}</TableCell>
      <TableCell className={IMPORTE}>{formatearPesos(totales.totalAjustes)}</TableCell>
      <TableCell className={cn(IMPORTE, 'font-semibold')}>
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
