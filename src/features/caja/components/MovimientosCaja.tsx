import Link from 'next/link'
import { Eye, HandCoins } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/utils/cn'

import type { Movimiento } from '../caja.types'
import {
  NOMBRE_TIPO_MOVIMIENTO,
  apellidoYNombre,
  esIngreso,
  textoHoraDeRegistro,
  textoImporteConSigno,
  textoMesLiquidado,
  textoMotivoAnulacion,
  textoNumeroComprobante,
  textoOperacion,
} from '../formato-caja'

const CELDA = 'px-3 first:pl-6 last:pr-6'

/** La acción de cada fila: sólo el ícono, como en "Pagos realizados". */
const accionDeFila =
  'focus-visible:ring-ring text-cobalto hover:bg-cobalto/10 inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

type MovimientosCajaProps = {
  movimientos: readonly Movimiento[]
  /** El día de la caja (el de la respuesta): decide qué hora se muestra con su fecha. */
  fecha: string
  /** Abre el detalle del pago de un cobro o de una anulación. */
  onAbrirPago: (pagoId: number) => void
  /** URL del listado de liquidaciones: un pago a profesor abre la suya. */
  rutaLiquidaciones: string
  /** Filas del día anterior mientras llegan las nuevas. */
  enEspera: boolean
}

/**
 * Los movimientos del día (HU-46), por hora de registro, como vienen de la API. El signo y el color
 * los da el `tipo`: un cobro suma (verde) y una anulación o un pago a un profesor restan (rojo). Un
 * cobro anulado lleva la marca "Anulado" y **su importe no se tacha**: ese día fue un cobro y suma;
 * lo que resta es su anulación, que figura aparte. Un cobro o una anulación abren el detalle del
 * pago; un pago a un profesor, su liquidación.
 */
export function MovimientosCaja({
  movimientos,
  fecha,
  onAbrirPago,
  rutaLiquidaciones,
  enEspera,
}: MovimientosCajaProps) {
  return (
    <Table
      aria-label="Movimientos de caja"
      className={cn(enEspera && 'opacity-60')}
      aria-busy={enEspera}
    >
      <TableHeader>
        <TableRow>
          <TableHead className={CELDA}>Hora</TableHead>
          <TableHead className={CELDA}>Tipo</TableHead>
          <TableHead className={CELDA}>Movimiento</TableHead>
          <TableHead className={CELDA}>Forma de pago</TableHead>
          <TableHead className={cn(CELDA, 'text-right')}>Importe</TableHead>
          <TableHead className={CELDA}>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movimientos.map((movimiento, i) => (
          <TableRow key={`${movimiento.tipo}-${movimiento.registradoEl}-${i}`}>
            <TableCell className={cn(CELDA, 'whitespace-nowrap tabular-nums')}>
              {textoHoraDeRegistro(movimiento.registradoEl, fecha)}
            </TableCell>
            <TableCell className={cn(CELDA, 'whitespace-nowrap')}>
              <div className="flex flex-col items-start gap-1">
                {NOMBRE_TIPO_MOVIMIENTO[movimiento.tipo]}
                {movimiento.tipo === 'COBRO' && movimiento.estado === 'ANULADO' && (
                  <Badge variant="cancelado">Anulado</Badge>
                )}
              </div>
            </TableCell>
            <TableCell className={cn(CELDA, 'whitespace-normal')}>
              <DetalleDelMovimiento movimiento={movimiento} />
            </TableCell>
            <TableCell className={cn(CELDA, 'whitespace-nowrap')}>
              {movimiento.formaPago.nombre}
            </TableCell>
            <TableCell
              className={cn(
                CELDA,
                'text-right font-medium whitespace-nowrap tabular-nums',
                esIngreso(movimiento.tipo) ? 'text-confirmado' : 'text-cancelado',
              )}
            >
              {textoImporteConSigno(movimiento)}
            </TableCell>
            <TableCell className={cn(CELDA, 'text-right')}>
              <AccionDelMovimiento
                movimiento={movimiento}
                onAbrirPago={onAbrirPago}
                rutaLiquidaciones={rutaLiquidaciones}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Qué fue el movimiento: lo propio de su tipo, con los mismos textos que el PDF. */
function DetalleDelMovimiento({ movimiento }: { movimiento: Movimiento }) {
  if (movimiento.tipo === 'PAGO_PROFESOR') {
    const operacion = textoOperacion(movimiento.numeroOperacion)
    return (
      <>
        <span className="font-medium">{apellidoYNombre(movimiento.profesor)}</span>
        <p className="text-muted-foreground text-xs">
          Liquidación de {textoMesLiquidado(movimiento.mes)}
          {operacion && ` · ${operacion}`}
        </p>
      </>
    )
  }

  return (
    <>
      <span className="font-medium">{apellidoYNombre(movimiento.alumno)}</span>
      <p className="text-muted-foreground text-xs tabular-nums">
        {textoNumeroComprobante(movimiento.numeroComprobante)}
      </p>
      {movimiento.tipo === 'ANULACION' && (
        <p className="text-cancelado mt-1 text-xs">Motivo: {textoMotivoAnulacion(movimiento)}</p>
      )}
    </>
  )
}

/**
 * La acción de la fila: un cobro o una anulación abren el detalle del pago (`onAbrirPago`, el mismo
 * mecanismo que `EnlaceDetallePago` de `pagos`); un pago a un profesor abre su liquidación, en
 * `${rutaLiquidaciones}/${profesorId}/${mes}`.
 */
function AccionDelMovimiento({
  movimiento,
  onAbrirPago,
  rutaLiquidaciones,
}: {
  movimiento: Movimiento
  onAbrirPago: (pagoId: number) => void
  rutaLiquidaciones: string
}) {
  if (movimiento.tipo === 'PAGO_PROFESOR') {
    const { liquidacion } = movimiento
    return (
      <Link
        href={`${rutaLiquidaciones}/${liquidacion.profesorId}/${liquidacion.mes}`}
        aria-label={`Ver la liquidación de ${apellidoYNombre(movimiento.profesor)} de ${textoMesLiquidado(liquidacion.mes)}`}
        title="Ver la liquidación"
        className={accionDeFila}
      >
        <HandCoins className="size-5" />
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onAbrirPago(movimiento.pagoId)}
      aria-label={`Ver detalle del pago ${textoNumeroComprobante(movimiento.numeroComprobante)}`}
      title="Ver detalle del pago"
      className={accionDeFila}
    >
      <Eye className="size-5" />
    </button>
  )
}
