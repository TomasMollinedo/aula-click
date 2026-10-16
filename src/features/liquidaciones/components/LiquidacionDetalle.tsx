'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  HandCoins,
  Landmark,
  ListChecks,
  RotateCw,
  SearchX,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/utils/cn'
import type { ApiError } from '@/utils/fetch-json'
import { textoMes } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'
import { formatearPorcentaje } from '@/utils/porcentaje'

import {
  fechaLarga,
  nombreDeProfesor,
  saldoADescontar,
  textoNumeroComprobante,
  textoRegistradoPor,
  totalAPagar,
} from '../formato-liquidaciones'
import { useLiquidacion } from '../hooks/use-liquidacion'
import { useMiLiquidacion } from '../hooks/use-mi-liquidacion'
import type { LiquidacionDetalle as Detalle, MiLiquidacionDetalle } from '../liquidaciones.types'
import { hrefPdfLiquidacion } from '../rutas-liquidaciones'
import { ComprobanteTransferencia } from './ComprobanteTransferencia'
import { EstadoLiquidacionBadge } from './EstadoLiquidacionBadge'
import { RegistrarPagoLiquidacionDialog } from './RegistrarPagoLiquidacionDialog'

export type LiquidacionDetalleProps =
  | {
      vista: 'gerente'
      /** El profesor, tal como viene en la URL (como en `ProfesorDetalle`). */
      profesorId: string
      /** El mes de la liquidación, `YYYY-MM`. */
      mes: string
      /** URL del listado de liquidaciones en el segmento ("Volver a liquidaciones" → `${rutaBase}?mes=${mes}`). */
      rutaBase: string
    }
  | {
      /** Dentro de "Mis ingresos": los endpoints `mis-liquidaciones/{mes}` toman el profesor de la sesión. */
      vista: 'profesor'
      /** El mes de la liquidación, `YYYY-MM`. */
      mes: string
    }

/** Lo que muestra el contenido: la vista decide qué se oculta, no solo lo que venga. */
type Contenido =
  | { vista: 'gerente'; liquidacion: Detalle; rutaBase: string }
  | { vista: 'profesor'; liquidacion: MiLiquidacionDetalle }

// Importes a la derecha, con cifras del mismo ancho y sin cortarse.
const IMPORTE = 'text-right tabular-nums whitespace-nowrap'

/**
 * Detalle de la liquidación de un profesor en un mes (HU-44): en
 * `/gerente/liquidaciones/[profesorId]/[mes]` y, con `vista="profesor"`, dentro de "Mis ingresos"
 * (HU-45). Muestra lo mismo que el PDF y en el mismo orden: turnos, ajustes, totales y el cierre.
 * La vista del profesor oculta "Volver", "Registrar pago", el comprobante de la transferencia, las
 * observaciones y quién registró el pago.
 */
export function LiquidacionDetalle(props: LiquidacionDetalleProps) {
  return props.vista === 'gerente' ? (
    <DetalleDelGerente profesorId={props.profesorId} mes={props.mes} rutaBase={props.rutaBase} />
  ) : (
    <DetalleDelProfesor mes={props.mes} />
  )
}

function DetalleDelGerente({
  profesorId,
  mes,
  rutaBase,
}: {
  profesorId: string
  mes: string
  rutaBase: string
}) {
  const query = useLiquidacion(profesorId, mes)
  const volver = (
    <Link
      href={`${rutaBase}?mes=${encodeURIComponent(mes)}`}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <ArrowLeft className="size-4" />
      Volver a liquidaciones
    </Link>
  )

  return (
    <Cargando
      volver={volver}
      isLoading={query.isLoading}
      error={query.error}
      onReintentar={() => query.refetch()}
    >
      {query.data && (
        <ContenidoLiquidacion
          contenido={{ vista: 'gerente', liquidacion: query.data, rutaBase }}
          volver={volver}
        />
      )}
    </Cargando>
  )
}

function DetalleDelProfesor({ mes }: { mes: string }) {
  const query = useMiLiquidacion(mes)
  return (
    <Cargando isLoading={query.isLoading} error={query.error} onReintentar={() => query.refetch()}>
      {query.data && (
        <ContenidoLiquidacion contenido={{ vista: 'profesor', liquidacion: query.data }} />
      )}
    </Cargando>
  )
}

/**
 * La carga y los errores de la lectura (docs/arquitectura-frontend.md → Manejo de errores en la
 * UI): 404 "Profesor no encontrado"; 400 (id o mes inválido o futuro) con el `message` de la API;
 * 403 sin permiso; cualquier otro (500, red), genérico con reintentar. El 401 lo resuelve
 * `providers.tsx`.
 */
function Cargando({
  volver,
  isLoading,
  error,
  onReintentar,
  children,
}: {
  volver?: ReactNode
  isLoading: boolean
  error: ApiError | null
  onReintentar: () => void
  children: ReactNode
}) {
  if (error?.status === 404) {
    return (
      <div className="space-y-6">
        {volver}
        <Card className="p-0">
          <EmptyState
            icon={SearchX}
            title="Profesor no encontrado"
            description="Puede que el enlace sea incorrecto."
          />
        </Card>
      </div>
    )
  }

  if (error) {
    const reintentar = error.status !== 400 && error.status !== 403
    return (
      <div className="space-y-6">
        {volver}
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
            {error.status === 400
              ? error.message
              : error.status === 403
                ? 'No tenés permiso para ver esta liquidación'
                : 'No se pudo cargar la liquidación. Revisá la conexión e intentá de nuevo.'}
            {reintentar && (
              <Button type="button" variant="outline" size="sm" onClick={onReintentar}>
                <RotateCw />
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Cargando la liquidación">
        {volver}
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  return <>{children}</>
}

function ContenidoLiquidacion({ contenido, volver }: { contenido: Contenido; volver?: ReactNode }) {
  const { liquidacion } = contenido
  const nombre = nombreDeProfesor(liquidacion.profesor)
  const mes = textoMes(liquidacion.mes)

  // Registrar pago: el diálogo recibe una copia de la liquidación al abrir y queda montado hasta
  // que se cierra, aunque al invalidarse el detalle el botón ya no se muestre. Si al cerrar el
  // botón ya no está, el foco va al título (docs/arquitectura-frontend.md → Un diálogo abierto
  // desde una acción sobrevive a la invalidación).
  const [pagando, setPagando] = useState<Detalle | null>(null)
  const [cierres, setCierres] = useState(0)
  const tituloRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (cierres === 0) return
    const timeout = setTimeout(() => {
      const activo = document.activeElement
      if (activo && activo !== document.body && activo.isConnected) return
      tituloRef.current?.focus()
    }, 0)
    return () => clearTimeout(timeout)
  }, [cierres])

  if (liquidacion.estado === null) {
    return (
      <div className="space-y-6">
        {volver}
        <Card className="p-0">
          <EmptyState icon={HandCoins} title={`No hay movimientos de ${nombre} en ${mes}`} />
        </Card>
      </div>
    )
  }

  const { cerrada } = liquidacion

  return (
    <div className="space-y-6">
      {volver}

      <PageHeader
        title={
          <span ref={tituloRef} tabIndex={-1} className="outline-none">
            {nombre}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            Liquidación de {mes}
            <EstadoLiquidacionBadge
              liquidacion={{
                estado: liquidacion.estado,
                fechaTransferencia: cerrada?.fechaTransferencia ?? null,
                descontadaEnMes: cerrada?.descontadaEnMes ?? null,
              }}
            />
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="accent" asChild>
              <a
                href={hrefPdfLiquidacion({
                  profesorId: liquidacion.profesor.id,
                  mes: liquidacion.mes,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText />
                Generar PDF
                <span className="sr-only">(abre el PDF en otra pestaña)</span>
              </a>
            </Button>
            {contenido.vista === 'gerente' && contenido.liquidacion.acciones.registrarPago && (
              <Button variant="confirmado" onClick={() => setPagando(contenido.liquidacion)}>
                <Wallet />
                Registrar pago
              </Button>
            )}
          </div>
        }
      />

      <Seccion icon={ListChecks} titulo="Turnos">
        {liquidacion.turnos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin turnos en el mes</p>
        ) : (
          <div className="-mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Materia</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right whitespace-nowrap">% del centro</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Parte del profesor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidacion.turnos.map((turno, indice) => (
                  // Un turno no trae id propio: el orden es el de la API y no cambia.
                  <TableRow key={indice}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {fechaLarga(turno.fecha)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {rangoHoras(turno.horaInicio, turno.horaFin)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {nombreDeProfesor(turno.alumno)}
                    </TableCell>
                    <TableCell>{turno.materia.nombre}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {textoNumeroComprobante(turno.numeroComprobante)}
                    </TableCell>
                    <TableCell className={IMPORTE}>{formatearPesos(turno.importe)}</TableCell>
                    <TableCell className={IMPORTE}>
                      {formatearPorcentaje(turno.porcentaje)}
                    </TableCell>
                    <TableCell className={IMPORTE}>{formatearPesos(turno.parteProfesor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Seccion>

      {liquidacion.ajustes.length > 0 && (
        <Seccion icon={HandCoins} titulo="Ajustes">
          <div className="-mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidacion.ajustes.map((ajuste, indice) => (
                  <TableRow key={indice}>
                    <TableCell className="min-w-56">{ajuste.texto}</TableCell>
                    <TableCell className={IMPORTE}>{formatearPesos(ajuste.importe)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Seccion>
      )}

      <Seccion icon={Wallet} titulo="Totales">
        <Datos className="lg:grid-cols-3">
          <Dato
            label="Turnos"
            valor={<span className="tabular-nums">{liquidacion.cantidadTurnos}</span>}
          />
          <Dato label="Total cobrado" valor={<Pesos importe={liquidacion.totalCobrado} />} />
          <Dato label="Parte del centro" valor={<Pesos importe={liquidacion.parteCentro} />} />
          <Dato label="Parte del profesor" valor={<Pesos importe={liquidacion.parteProfesor} />} />
          <Dato label="Ajustes" valor={<Pesos importe={liquidacion.totalAjustes} />} />
          <Dato
            label="Total a pagar"
            valor={
              <Pesos importe={totalAPagar(liquidacion.total)} className="text-xl font-semibold" />
            }
          />
          {saldoADescontar(liquidacion.total) !== null && (
            <Dato
              label="Saldo a descontar el mes próximo"
              valor={
                <Pesos
                  importe={liquidacion.total}
                  className="text-cancelado text-xl font-semibold"
                />
              }
            />
          )}
        </Datos>
      </Seccion>

      <Cierre contenido={contenido} />

      {pagando && (
        <RegistrarPagoLiquidacionDialog
          liquidacion={pagando}
          onCerrar={() => {
            setPagando(null)
            setCierres((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

/** El cierre según el estado: la transferencia, la liquidación que la absorbió o una aclaración. */
function Cierre({ contenido }: { contenido: Contenido }) {
  const { liquidacion } = contenido

  switch (liquidacion.estado) {
    case 'PAGADA': {
      const { cerrada } = liquidacion
      return (
        <Seccion icon={Landmark} titulo="Transferencia">
          <Datos>
            <Dato
              label="Fecha"
              valor={cerrada?.fechaTransferencia ? fechaLarga(cerrada.fechaTransferencia) : null}
            />
            <Dato label="Número de operación" valor={cerrada?.numeroOperacion} />
            {contenido.vista === 'gerente' && contenido.liquidacion.cerrada?.observaciones && (
              <Dato
                label="Observaciones"
                valor={contenido.liquidacion.cerrada.observaciones}
                className="sm:col-span-2"
              />
            )}
          </Datos>
          {contenido.vista === 'gerente' && contenido.liquidacion.cerrada && (
            <>
              <ComprobanteTransferencia
                liquidacionId={contenido.liquidacion.cerrada.liquidacionId}
                comprobante={contenido.liquidacion.cerrada.comprobanteAdjunto}
              />
              <p className="text-muted-foreground border-border border-t pt-4 text-xs">
                {textoRegistradoPor(
                  contenido.liquidacion.cerrada.registradaPor,
                  contenido.liquidacion.cerrada.registradaEl,
                )}
              </p>
            </>
          )}
        </Seccion>
      )
    }
    case 'DESCONTADA': {
      const enMes = liquidacion.cerrada?.descontadaEnMes
      if (!enMes) return null
      return (
        <Aclaracion>
          Descontada en la liquidación de{' '}
          {contenido.vista === 'gerente' ? (
            <Link
              href={`${contenido.rutaBase}/${liquidacion.profesor.id}/${enMes}`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              {textoMes(enMes)}
            </Link>
          ) : (
            textoMes(enMes)
          )}
        </Aclaracion>
      )
    }
    case 'EN_CURSO':
      return (
        <Aclaracion>
          El mes está en curso: la liquidación puede cambiar hasta que termine
        </Aclaracion>
      )
    case 'SALDO_A_DESCONTAR':
      return <Aclaracion>El saldo se descuenta en la próxima liquidación del profesor</Aclaracion>
    default:
      return null
  }
}

function Seccion({
  icon: Icon,
  titulo,
  children,
}: {
  icon: LucideIcon
  titulo: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="text-cobalto size-4" />
        {titulo}
      </h2>
      {children}
    </Card>
  )
}

function Aclaracion({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}

function Pesos({ importe, className }: { importe: number; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {formatearPesos(importe)}
    </span>
  )
}
