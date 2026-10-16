'use client'

import { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { AlertCircle, HandCoins, RotateCw } from 'lucide-react'

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
import {
  anioDe,
  aniosOfrecidos,
  esMesFuturo,
  etiquetaNumeroMes,
  MESES_DEL_ANIO,
  mesDeAnioYNumero,
  numeroDeMes,
} from '@/utils/meses'
import { formatearPesos } from '@/utils/moneda'

import {
  nombreDeProfesor,
  saldoADescontar,
  TEXTO_ESTADO_FILTRO,
  totalAPagar,
} from '../formato-liquidaciones'
import { useLiquidacionesDelMes } from '../hooks/use-liquidaciones-del-mes'
import { useMesLiquidacionEnUrl } from '../hooks/use-mes-liquidacion-en-url'
import {
  ESTADOS_LIQUIDACION,
  type EstadoLiquidacion,
  type LiquidacionesDelMes as Listado,
  type TotalesLiquidacion,
} from '../liquidaciones.types'
import { EstadoLiquidacionBadge } from './EstadoLiquidacionBadge'
import { FiltroProfesorDeLiquidaciones } from './FiltroProfesorDeLiquidaciones'

export type LiquidacionesDelMesProps = {
  /**
   * URL del listado en el segmento (`/gerente/liquidaciones`); el detalle de una liquidación es
   * `${rutaBase}/${profesorId}/${mes}`.
   */
  rutaBase: string
}

// Importes a la derecha, con cifras del mismo ancho y sin cortarse.
const IMPORTE = 'text-right tabular-nums whitespace-nowrap'

/**
 * Listado de liquidaciones del mes (HU-44), en `/gerente/liquidaciones`: el mes se elige con dos
 * selectores, mes y año, que van juntos en la URL como un solo `?mes=AAAA-MM` (sin él, el mes en
 * curso). Cambiar uno conserva el otro. Mientras llega el mes nuevo se ve el anterior atenuado. Se puede filtrar por profesor (`?profesorId=`, con un buscador) y por estado
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

  const hayFiltros = mes !== mesEnCurso || profesorId !== undefined || estado !== undefined

  return (
    <div className="space-y-6">
      <BarraFiltros
        hayFiltros={hayFiltros}
        onLimpiar={limpiarFiltros}
        limpiarEnFila="lg"
        className="sm:grid-cols-2 lg:grid-cols-[minmax(0,10rem)_minmax(0,7rem)_minmax(0,18rem)_minmax(0,14rem)_auto]"
      >
        <Field label="Mes" htmlFor={`${id}-mes`}>
          <FiltroMes id={`${id}-mes`} mes={mes} mesEnCurso={mesEnCurso} onElegir={elegirMes} />
        </Field>
        <Field label="Año" htmlFor={`${id}-anio`}>
          <FiltroAnio id={`${id}-anio`} mes={mes} mesEnCurso={mesEnCurso} onElegir={elegirMes} />
        </Field>
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

type SelectorDeMesProps = {
  id: string
  /** El mes elegido, `YYYY-MM`. */
  mes: string
  /** El mes actual, `YYYY-MM`: no se ofrecen meses posteriores. */
  mesEnCurso: string
  /** Recibe el mes completo (`YYYY-MM`): cambiar uno de los dos selectores conserva el otro. */
  onElegir: (mes: string) => void
}

/** El selector del mes del año; los que todavía no llegaron aparecen deshabilitados. */
function FiltroMes({ id, mes, mesEnCurso, onElegir }: SelectorDeMesProps) {
  const anio = anioDe(mes)
  return (
    <Select
      value={String(numeroDeMes(mes))}
      onValueChange={(numero) => onElegir(mesDeAnioYNumero(anio, Number(numero)))}
    >
      <SelectTrigger id={id} className={cn(claseControlFiltro(false), 'capitalize')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MESES_DEL_ANIO.map((numero) => (
          <SelectItem
            key={numero}
            value={String(numero)}
            className="capitalize"
            disabled={esMesFuturo(mesDeAnioYNumero(anio, numero), `${mesEnCurso}-01`)}
          >
            {etiquetaNumeroMes(numero)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** El selector del año: el actual y los anteriores (más el de un mes viejo que venga en la URL). */
function FiltroAnio({ id, mes, mesEnCurso, onElegir }: SelectorDeMesProps) {
  const numero = numeroDeMes(mes)
  return (
    <Select
      value={String(anioDe(mes))}
      onValueChange={(anio) => onElegir(mesDeAnioYNumero(Number(anio), numero))}
    >
      <SelectTrigger id={id} className={claseControlFiltro(false)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {aniosOfrecidos(`${mesEnCurso}-01`, mes).map((anio) => (
          <SelectItem key={anio} value={String(anio)}>
            {anio}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    // Desde `xl` el contenedor de la tabla no hace scroll propio y la tarjeta recorta sin ser un
    // scroll (`overflow-clip`): así la fila del total (sticky) se pega al scroll de la página (el
    // `bottom` negativo compensa el padding de `<main>`, que el sticky respeta). Más
    // angosto, la tabla vuelve a hacer scroll horizontal dentro de la tarjeta.
    <Card className="gap-0 overflow-hidden p-0 xl:overflow-clip">
      <Table
        containerClassName="xl:overflow-visible"
        // Las columnas de importes, más juntas (la primera y la última conservan su margen): con la
        // tabla sin scroll propio tiene que entrar en la tarjeta.
        className="[&_td]:px-4 [&_td:first-child]:px-6 [&_td:last-child]:px-6 [&_th]:px-4 [&_th:first-child]:px-6 [&_th:last-child]:px-6"
      >
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
              <Importes totales={fila} aPagar={totalAPagar(fila.total)} />
              <TableCell className="whitespace-nowrap">
                <EstadoLiquidacionBadge liquidacion={fila} />
                <SaldoADescontar total={fila.total} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {/* Fija abajo mientras se hace scroll, con fondo sólido y una línea de marca arriba (en una
            tabla con bordes colapsados el borde de una fila sticky no se dibuja: va como sombra). */}
        <TableFooter className="bg-canvas sticky bottom-[-2.5rem] z-10 border-t-0 [&_td]:shadow-[inset_0_2px_0_0_var(--color-cobalto)]">
          <TableRow className="hover:bg-transparent">
            <TableCell className="py-4 text-base font-bold whitespace-nowrap">
              {conFiltro ? 'Total' : 'Total del mes'}
            </TableCell>
            <Importes totales={totales} aPagar={totales.totalAPagar} destacada />
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
function Importes({
  totales,
  aPagar,
  destacada = false,
}: {
  totales: TotalesLiquidacion
  aPagar: number
  /** La fila del total: mismas columnas, con más cuerpo y sin los tonos apagados. */
  destacada?: boolean
}) {
  return (
    <>
      <TableCell className={cn(IMPORTE, destacada && 'text-base font-bold')}>
        {totales.cantidadTurnos}
      </TableCell>
      <TableCell
        className={cn(IMPORTE, destacada ? 'text-base font-bold' : 'text-muted-foreground')}
      >
        {formatearPesos(totales.totalCobrado)}
      </TableCell>
      <TableCell
        className={cn(
          IMPORTE,
          'text-confirmado',
          destacada ? 'text-base font-bold' : 'font-semibold',
        )}
      >
        {formatearPesos(totales.parteCentro)}
      </TableCell>
      <TableCell className={cn(IMPORTE, destacada && 'text-base font-bold')}>
        {formatearPesos(totales.parteProfesor)}
      </TableCell>
      <TableCell
        className={cn(
          IMPORTE,
          destacada && 'text-base',
          totales.totalAjustes < 0
            ? 'text-cancelado font-semibold'
            : destacada
              ? 'text-muted-foreground font-bold'
              : 'text-muted-foreground/60',
        )}
      >
        {formatearPesos(totales.totalAjustes)}
      </TableCell>
      <TableCell
        className={cn(
          IMPORTE,
          aPagar > 0 ? 'text-base font-bold' : 'text-muted-foreground',
          destacada && 'text-lg font-bold',
        )}
      >
        {formatearPesos(aPagar)}
      </TableCell>
    </>
  )
}

/**
 * Bajo el estado de una liquidación con total negativo: el saldo que se descuenta del mes
 * siguiente. No es lo que hay que pagar (eso queda en $ 0): es un ajuste que se traslada.
 */
function SaldoADescontar({ total }: { total: number }) {
  const saldo = saldoADescontar(total)
  if (saldo === null) return null
  return (
    <p className="text-cancelado mt-1 text-xs font-medium tabular-nums">
      Saldo: {formatearPesos(saldo)}
    </p>
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
              Ver el mes actual
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
