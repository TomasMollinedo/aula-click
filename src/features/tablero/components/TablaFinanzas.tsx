'use client'

import { useState } from 'react'

import { Card } from '@/components/ui/card'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PaginatedResponse } from '@/types'
import { cn } from '@/utils/cn'
import { formatearPesos } from '@/utils/moneda'

import {
  etiquetasDeMeses,
  formatearCantidad,
  nombreDeProfesor,
  tituloDeMes,
} from '../formato-tablero'
import type {
  DireccionOrden,
  EvolucionMes,
  FilaProfesorFinanzas,
  OrdenFinanzas,
} from '../tablero.types'
import { GraficoBarras, type SerieBarras } from './GraficoBarras'
import { TarjetaDeTabla } from './TarjetaDeTabla'

// Las dos tablas de la sección "Finanzas" (HU-47). Sólo dibujan lo que manda la API: el reparto de
// cada cobro, los saldos y el orden de las filas los calcula el motor de liquidaciones. **Nunca un
// alumno ni un pago puntual:** el contrato sólo manda agregados por profesor y por mes.
//
// En pantallas chicas la tabla se desplaza dentro de su contenedor (el `overflow-x-auto` de
// `Table`), no la página entera.

/** Las columnas de dinero de la tabla por profesor, todas ordenables y todas en pesos. */
const IMPORTES: {
  campo: 'totalCobrado' | 'parteCentro' | 'parteProfesor' | 'pagado'
  titulo: string
}[] = [
  { campo: 'totalCobrado', titulo: 'Total cobrado' },
  { campo: 'parteCentro', titulo: 'Parte del centro' },
  { campo: 'parteProfesor', titulo: 'Parte del profesor' },
  { campo: 'pagado', titulo: 'Pagado' },
]

/**
 * Las tres cifras de cada mes, con tokens de `globals.css` (no se inventa ningún color): el cobalto
 * de la marca, el dorado de los acentos y el verde `confirmado` con el que la app ya escribe
 * "Pagado". La leyenda del gráfico y el encabezado de la tabla las nombran igual.
 */
const SERIES_EVOLUCION: readonly (SerieBarras & { campo: keyof Omit<EvolucionMes, 'mes'> })[] = [
  {
    campo: 'totalCobrado',
    etiqueta: 'Total cobrado',
    claseRelleno: 'fill-cobalto',
    claseFondo: 'bg-cobalto',
  },
  {
    campo: 'margenCentro',
    etiqueta: 'Margen del centro',
    claseRelleno: 'fill-dorado',
    claseFondo: 'bg-dorado',
  },
  {
    campo: 'pagadoAProfesores',
    etiqueta: 'Pagado a profesores',
    // El mismo verde con el que la app escribe "Pagado" en los badges de estado de pago.
    claseRelleno: 'fill-confirmado',
    claseFondo: 'bg-confirmado',
  },
]

/**
 * Qué mide la tabla por profesor: de dónde sale cada columna y por qué un turno cerrado sin
 * registrar entra entero en la parte del centro.
 */
const ACLARACION_REPARTO =
  'Los turnos cobrados y su reparto son por fecha de pago; lo pagado, por fecha de transferencia. Un turno cobrado que el sistema cerró sin asistencia registrada no se le debe al profesor: va entero a la parte del centro. El saldo pendiente es a hoy y puede ser negativo (un saldo a descontar el mes próximo).'

/**
 * La tabla por profesor: se reordena por cualquier columna (lo hace la API) y se ve de a 10 filas.
 * Trae a los profesores, activos o no, con algún movimiento en el período o un saldo a hoy.
 */
export function TablaProfesoresFinanzas({
  profesores,
  orden,
  direccion,
  onOrdenar,
  page,
  onPageChange,
  enEspera,
}: {
  profesores: PaginatedResponse<FilaProfesorFinanzas> | null
  orden: OrdenFinanzas
  direccion: DireccionOrden
  onOrdenar: (columna: OrdenFinanzas) => void
  page: number
  onPageChange: (page: number) => void
  enEspera: boolean
}) {
  return (
    <TarjetaDeTabla
      titulo="Cobros y pagos por profesor"
      descripcion={ACLARACION_REPARTO}
      nombres={{ singular: 'profesor', plural: 'profesores' }}
      textoVacio="No hay profesores con cobros ni pagos en este período"
      page={page}
      onPageChange={onPageChange}
      enEspera={enEspera}
      filas={profesores?.data.length ?? 0}
      meta={profesores?.meta ?? null}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              columna="profesor"
              orden={orden}
              direccion={direccion}
              onOrdenar={onOrdenar}
            >
              Profesor
            </SortableTableHead>
            <SortableTableHead
              numerica
              columna="turnosCobrados"
              orden={orden}
              direccion={direccion}
              onOrdenar={onOrdenar}
            >
              Turnos cobrados
            </SortableTableHead>
            {IMPORTES.map(({ campo, titulo }) => (
              <SortableTableHead
                key={campo}
                numerica
                columna={campo}
                orden={orden}
                direccion={direccion}
                onOrdenar={onOrdenar}
              >
                {titulo}
              </SortableTableHead>
            ))}
            <SortableTableHead
              numerica
              columna="saldoPendiente"
              orden={orden}
              direccion={direccion}
              onOrdenar={onOrdenar}
            >
              Saldo pendiente
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profesores?.data.map((fila) => (
            <TableRow key={fila.profesor.id}>
              <TableCell className="font-medium">{nombreDeProfesor(fila.profesor)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatearCantidad(fila.turnosCobrados)}
              </TableCell>
              {IMPORTES.map(({ campo }) => (
                <TableCell key={campo} className="text-right tabular-nums">
                  {formatearPesos(fila[campo])}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">
                {formatearPesos(fila.saldoPendiente)}
                {/* Un saldo negativo no se le debe: se le descuenta de la próxima liquidación. */}
                {fila.saldoPendiente < 0 && (
                  <span className="text-muted-foreground block text-xs">a descontar</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TarjetaDeTabla>
  )
}

/**
 * La evolución mensual: los 6 meses que terminan en el del fin del período, **del más reciente al
 * más alejado**. La API los manda al revés (del más viejo al más nuevo, como los usa el PDF): el
 * array se invierte **sólo para mostrarlo**, en el gráfico y en la tabla, así los dos cuentan la
 * misma historia y el mes que más se mira queda primero. No es un cálculo: no pagina, no se
 * reordena por columna y el último mes del período llega hasta `hasta`, no hasta fin de mes.
 *
 * El mes elegido es el único estado de la tarjeta y lo comparten la tabla y el gráfico: se elige
 * clickeando el mes en la tabla (un `<button>`, así también se llega con el teclado) o su franja en
 * el gráfico, y volver a clickearlo lo suelta. Sólo resalta: no filtra ni cambia ningún número. Si
 * cambia el período y ese mes ya no está, queda sin elegir sin tener que limpiarlo a mano.
 */
export function TablaEvolucionFinanzas({
  evolucion,
  enEspera,
}: {
  evolucion: EvolucionMes[]
  enEspera: boolean
}) {
  const [mesClickeado, setMesClickeado] = useState<string | null>(null)

  // Del mes más reciente al más alejado: una copia, para no tocar lo que mandó la API.
  const meses = [...evolucion].reverse()
  const etiquetas = etiquetasDeMeses(meses.map(({ mes }) => mes))
  // Un mes que ya no está en la respuesta (cambió el período) no resalta nada.
  const elegido = meses.some(({ mes }) => mes === mesClickeado) ? mesClickeado : null
  const alternar = (mes: string) => setMesClickeado((actual) => (actual === mes ? null : mes))

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-border border-b p-6">
        <h3 className="text-sm leading-tight font-semibold">Evolución de los últimos 6 meses</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Del mes más reciente al más alejado. Meses completos, salvo el del período elegido, que
          llega hasta su fin. Lo cobrado y el margen van por fecha de pago; lo pagado a profesores,
          por fecha de transferencia. Elegí un mes para resaltarlo en el gráfico.
        </p>
      </div>
      <div aria-busy={enEspera} className={enEspera ? 'opacity-50 transition-opacity' : undefined}>
        <div className="border-border space-y-2 border-b p-6">
          <GraficoBarras
            series={SERIES_EVOLUCION}
            grupos={meses.map((mes, indice) => ({
              clave: mes.mes,
              etiqueta: etiquetas[indice] ?? mes.mes,
              titulo: tituloDeMes(mes.mes),
              valores: SERIES_EVOLUCION.map(({ campo }) => mes[campo]),
            }))}
            descripcion="Evolución mes a mes, del más reciente al más alejado, del total cobrado, el margen del centro y lo pagado a profesores. Los mismos números están en la tabla de abajo."
            formatearValor={formatearPesos}
            formatearEje={formatearCantidad}
            elegido={elegido}
            onElegir={alternar}
          />
          <p className="text-muted-foreground text-xs">
            Importes en pesos. Un mes sin movimientos queda en cero.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              <TableHead className="text-right">Total cobrado</TableHead>
              <TableHead className="text-right">Margen del centro</TableHead>
              <TableHead className="text-right">Pagado a profesores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meses.map((mes) => (
              <TableRow
                key={mes.mes}
                className={cn(mes.mes === elegido && 'bg-cobalto/5 hover:bg-cobalto/5')}
              >
                {/* Un botón, no la fila entera: así se llega con el teclado y se anuncia si está
                    elegido. Resaltar es sólo visual, no filtra ningún número. */}
                <TableCell className="p-0">
                  <button
                    type="button"
                    onClick={() => alternar(mes.mes)}
                    aria-pressed={mes.mes === elegido}
                    className="hover:text-cobalto focus-visible:ring-ring/50 w-full px-6 py-4 text-left font-medium outline-none focus-visible:ring-2"
                  >
                    {tituloDeMes(mes.mes)}
                    <span className="sr-only">
                      {mes.mes === elegido
                        ? '. Resaltado en el gráfico. Activar para soltarlo.'
                        : '. Activar para resaltarlo en el gráfico.'}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatearPesos(mes.totalCobrado)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatearPesos(mes.margenCentro)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatearPesos(mes.pagadoAProfesores)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
