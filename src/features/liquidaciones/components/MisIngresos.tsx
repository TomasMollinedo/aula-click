'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  FileText,
  HandCoins,
  History,
  RotateCw,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/utils/cn'
import type { ApiError } from '@/utils/fetch-json'
import { textoMes } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import { fechaLarga, nombreDeProfesor } from '../formato-liquidaciones'
import { useMisIngresos } from '../hooks/use-mis-ingresos'
import { useMisIngresosEnUrl } from '../hooks/use-mis-ingresos-en-url'
import { useMisLiquidaciones } from '../hooks/use-mis-liquidaciones'
import type { ClaseDeMisIngresos, MisIngresos as Datos } from '../liquidaciones.types'
import {
  PESTANAS_MIS_INGRESOS,
  REGISTROS_POR_PAGINA,
  hrefAsistenciaDelDia,
  paginar,
  textoMostrando,
} from '../mis-ingresos'
import { hrefPdfMiLiquidacion } from '../rutas-liquidaciones'
import { EstadoLiquidacionBadge } from './EstadoLiquidacionBadge'
import { LiquidacionDetalle } from './LiquidacionDetalle'

export type MisIngresosProps = {
  /** URL de "Asistencia" del profesor, el acceso de "Clases cobradas sin asistencia". */
  hrefAsistencia: string
}

/**
 * "Mis ingresos" del profesor (HU-45, T-133), en `/profesor/ingresos`, de sólo lectura y pensada
 * para el celular, en cuatro pestañas (`?tab=`) para que no quede tan larga: "Este mes", "Sin
 * cobrar", "Sin asistencia" (con el acceso a "Asistencia") y "Liquidaciones", que abre el detalle
 * (`LiquidacionDetalle` en vista de profesor, `?liquidacion=AAAA-MM`). Los importes y qué clases van en cada sección los decide la
 * API (`GET /liquidaciones/mis-ingresos` y `/mis-liquidaciones`): acá sólo se muestran.
 */
export function MisIngresos({ hrefAsistencia }: MisIngresosProps) {
  const url = useMisIngresosEnUrl()

  if (url.liquidacionAbierta !== null) {
    return (
      <div className="space-y-6">
        <Link
          href={url.hrefLiquidacion(null)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="size-4" />
          Volver a mis ingresos
        </Link>
        <LiquidacionDetalle vista="profesor" mes={url.liquidacionAbierta} />
      </div>
    )
  }

  return (
    <Tabs
      value={url.pestana}
      onValueChange={(valor) =>
        url.cambiarPestana(PESTANAS_MIS_INGRESOS.find((p) => p === valor) ?? 'este-mes')
      }
      className="space-y-6"
    >
      {/* Cuatro pestañas: en el celular la barra se desplaza sola en lugar de desbordar la página. */}
      <div className="max-w-full overflow-x-auto">
        <TabsList>
          <TabsTrigger value="este-mes" className="px-3">
            <Wallet />
            Este mes
          </TabsTrigger>
          <TabsTrigger value="sin-cobrar" className="px-3">
            <HandCoins />
            Sin cobrar
          </TabsTrigger>
          <TabsTrigger value="sin-asistencia" className="px-3">
            <ClipboardCheck />
            Sin asistencia
          </TabsTrigger>
          <TabsTrigger value="liquidaciones" className="px-3">
            <History />
            Liquidaciones
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Las tres primeras leen lo mismo (`mis-ingresos`, una sola vez en la caché). */}
      <TabsContent value="este-mes">
        <ConMisIngresos>
          {(datos) => (
            <EsteMes liquidacion={datos.esteMes} page={url.page} onPageChange={url.cambiarPagina} />
          )}
        </ConMisIngresos>
      </TabsContent>

      <TabsContent value="sin-cobrar">
        <ConMisIngresos>
          {(datos) => {
            const pagina = paginar(datos.clasesSinCobrar, url.page)
            return (
              <Seccion
                icon={HandCoins}
                titulo="Clases dadas sin cobrar"
                aclaracion="Se suman a tu liquidación cuando el alumno las pague."
                vacio="No tenés clases dadas sin cobrar"
                pie={
                  <PiePaginado
                    page={pagina.page}
                    totalPages={pagina.totalPages}
                    total={datos.clasesSinCobrar.length}
                    nombres={{ singular: 'clase', plural: 'clases' }}
                    onPageChange={url.cambiarPagina}
                  />
                }
              >
                {pagina.items.map((clase) => (
                  <FilaClase key={`${clase.turnoId}-${clase.fecha}`} clase={clase} />
                ))}
              </Seccion>
            )
          }}
        </ConMisIngresos>
      </TabsContent>

      <TabsContent value="sin-asistencia">
        <ConMisIngresos>
          {(datos) => {
            const pagina = paginar(datos.clasesCobradasSinAsistencia, url.page)
            return (
              <Seccion
                icon={ClipboardCheck}
                titulo="Clases cobradas sin asistencia"
                aclaracion="Registrá la asistencia para que se sumen a tu liquidación. Si vence el plazo, no se te pagan."
                vacio="No tenés clases cobradas sin asistencia"
                pie={
                  <PiePaginado
                    page={pagina.page}
                    totalPages={pagina.totalPages}
                    total={datos.clasesCobradasSinAsistencia.length}
                    nombres={{ singular: 'clase', plural: 'clases' }}
                    onPageChange={url.cambiarPagina}
                  />
                }
              >
                {pagina.items.map((clase) => (
                  <FilaClase
                    key={`${clase.turnoId}-${clase.fecha}`}
                    clase={clase}
                    extra={
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-urgente text-sm font-medium">
                          Vence el {fechaLarga(clase.vence)}
                        </span>
                        <Link
                          href={hrefAsistenciaDelDia(hrefAsistencia, clase.fecha)}
                          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                        >
                          Ir a Asistencia
                        </Link>
                      </span>
                    }
                  />
                ))}
              </Seccion>
            )
          }}
        </ConMisIngresos>
      </TabsContent>

      <TabsContent value="liquidaciones">
        <MisLiquidacionesSeccion
          page={url.page}
          onPageChange={url.cambiarPagina}
          hrefLiquidacion={url.hrefLiquidacion}
        />
      </TabsContent>
    </Tabs>
  )
}

/** Lee `GET /liquidaciones/mis-ingresos` y muestra su carga o su error; con datos, `children`. */
function ConMisIngresos({ children }: { children: (datos: Datos) => ReactNode }) {
  const query = useMisIngresos()

  if (query.isError) {
    return <ErrorDeCarga error={query.error} onReintentar={() => query.refetch()} />
  }
  if (!query.data) {
    return (
      <div role="status" aria-label="Cargando tus ingresos">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }
  return <>{children(query.data)}</>
}

/** "Este mes": los turnos de la liquidación en curso con su parte y el total acumulado. */
function EsteMes({
  liquidacion,
  page,
  onPageChange,
}: {
  liquidacion: Datos['esteMes']
  page: number
  onPageChange: (page: number) => void
}) {
  const pagina = paginar(liquidacion.turnos, page)
  return (
    <Seccion
      icon={Wallet}
      titulo={`Este mes · ${textoMes(liquidacion.mes)}`}
      encabezado={
        // Arriba, para que no se pierda debajo de la lista. Es el del mes entero (el de la API),
        // no el de la página.
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 pt-2">
          <span className="font-semibold">Total acumulado</span>
          <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
            {formatearPesos(liquidacion.total)}
          </span>
        </p>
      }
      vacio="Todavía no tenés clases en tu liquidación de este mes"
      pie={
        <PiePaginado
          page={pagina.page}
          totalPages={pagina.totalPages}
          total={liquidacion.turnos.length}
          nombres={{ singular: 'clase', plural: 'clases' }}
          onPageChange={onPageChange}
        />
      }
    >
      {pagina.items.map((turno, indice) => (
        // Un turno no trae id propio: el orden es el de la API y no cambia.
        <li
          key={(pagina.page - 1) * REGISTROS_POR_PAGINA + indice}
          className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6"
        >
          <DatosDeClase
            fecha={turno.fecha}
            horaInicio={turno.horaInicio}
            horaFin={turno.horaFin}
            alumno={turno.alumno}
            materia={turno.materia}
          />
          <span className="text-sm font-medium whitespace-nowrap tabular-nums">
            {formatearPesos(turno.parteProfesor)}
          </span>
        </li>
      ))}
    </Seccion>
  )
}

/** "Mis liquidaciones": mes, total, estado, el detalle y el PDF de cada una, paginadas. */
function MisLiquidacionesSeccion({
  page,
  onPageChange,
  hrefLiquidacion,
}: {
  page: number
  onPageChange: (page: number) => void
  hrefLiquidacion: (mes: string) => string
}) {
  const query = useMisLiquidaciones(page)

  if (query.isError) {
    return <ErrorDeCarga error={query.error} onReintentar={() => query.refetch()} />
  }
  if (!query.data) {
    return <Skeleton className="h-40 w-full rounded-2xl" />
  }

  const { data, meta } = query.data
  return (
    <Seccion
      icon={History}
      titulo="Mis liquidaciones"
      vacio="Todavía no tenés liquidaciones"
      atenuada={query.isPlaceholderData}
      pie={
        <PiePaginado
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          nombres={{ singular: 'liquidación', plural: 'liquidaciones' }}
          onPageChange={onPageChange}
        />
      }
    >
      {data.map((fila) => (
        // Mes y, debajo, su estado a la izquierda; total y botones a la derecha. En el celular, si no
        // entra, los botones bajan.
        <li
          key={fila.mes}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6"
        >
          {/* El estado, debajo del mes. */}
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-medium first-letter:uppercase">{textoMes(fila.mes)}</span>
            <EstadoLiquidacionBadge
              liquidacion={{
                estado: fila.estado,
                fechaTransferencia: fila.fechaTransferencia,
                descontadaEnMes: null,
              }}
            />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-semibold whitespace-nowrap tabular-nums">
              {formatearPesos(fila.total)}
            </span>
            {/* El ojo azul de "ver detalle", como en las tablas de alumnos y materias. */}
            <Link
              href={hrefLiquidacion(fila.mes)}
              aria-label={`Ver detalle de la liquidación de ${textoMes(fila.mes)}`}
              title="Ver detalle"
              className="text-cobalto hover:bg-cobalto/10 focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
            >
              <Eye className="size-5" />
            </Link>
            {/* El mismo "Generar PDF" del detalle de la liquidación. */}
            <Button variant="accent" size="sm" asChild>
              <a href={hrefPdfMiLiquidacion(fila.mes)} target="_blank" rel="noopener noreferrer">
                <FileText />
                Generar PDF
                <span className="sr-only">(abre el PDF en otra pestaña)</span>
              </a>
            </Button>
          </span>
        </li>
      ))}
    </Seccion>
  )
}

/** "Mostrando 1–10 de 23 clases" y los botones de página; nada si entra en una sola. */
function PiePaginado({
  page,
  totalPages,
  total,
  nombres,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  nombres: { singular: string; plural: string }
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-muted-foreground text-sm">{textoMostrando(page, total, nombres)}</p>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

/** Una tarjeta con su título, una aclaración y una lista; sin filas, dice que está vacía. */
function Seccion({
  icon: Icon,
  titulo,
  aclaracion,
  encabezado,
  vacio,
  pie,
  atenuada = false,
  children,
}: {
  icon: LucideIcon
  titulo: string
  aclaracion?: string
  /** Debajo del título y la aclaración, por ejemplo el total de "Este mes". */
  encabezado?: ReactNode
  vacio: string
  pie?: ReactNode
  atenuada?: boolean
  children: ReactNode[]
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="space-y-1 px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
        <h2 className="flex items-center gap-2 font-semibold first-letter:uppercase">
          <Icon aria-hidden className="text-cobalto size-4 shrink-0" />
          {titulo}
        </h2>
        {aclaracion && <p className="text-muted-foreground text-sm">{aclaracion}</p>}
        {encabezado}
      </div>
      {children.length === 0 ? (
        <p className="text-muted-foreground border-border flex items-center gap-2 border-t px-4 py-6 text-sm sm:px-6">
          <CalendarCheck aria-hidden className="size-4 shrink-0" />
          {vacio}
        </p>
      ) : (
        <ul
          aria-busy={atenuada}
          className={cn('divide-border border-border divide-y border-t', atenuada && 'opacity-60')}
        >
          {children}
        </ul>
      )}
      {children.length > 0 && pie}
    </Card>
  )
}

/** Fecha y horario arriba; alumno y materia abajo. */
function DatosDeClase({
  fecha,
  horaInicio,
  horaFin,
  alumno,
  materia,
}: Pick<ClaseDeMisIngresos, 'fecha' | 'horaInicio' | 'horaFin' | 'alumno' | 'materia'>) {
  return (
    <span className="min-w-0 space-y-0.5">
      <span className="block text-sm font-medium tabular-nums">
        {fechaLarga(fecha)} · {rangoHoras(horaInicio, horaFin)}
      </span>
      <span className="text-muted-foreground block text-sm">
        {nombreDeProfesor(alumno)} · {materia.nombre}
      </span>
    </span>
  )
}

function FilaClase({ clase, extra }: { clase: ClaseDeMisIngresos; extra?: ReactNode }) {
  return (
    <li className="space-y-1.5 px-4 py-3 sm:px-6">
      <DatosDeClase {...clase} />
      {extra}
    </li>
  )
}

/** 403 (sin ficha de profesor) sin reintentar; cualquier otro error, con reintentar. */
function ErrorDeCarga({
  error,
  onReintentar,
}: {
  error: ApiError | null
  onReintentar: () => void
}) {
  const sinPermiso = error?.status === 403
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
        {sinPermiso
          ? 'No tenés permiso para ver estos ingresos'
          : 'No se pudieron cargar tus ingresos. Revisá la conexión e intentá de nuevo.'}
        {!sinPermiso && (
          <Button type="button" variant="outline" size="sm" onClick={onReintentar}>
            <RotateCw />
            Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
