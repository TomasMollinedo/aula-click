'use client'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatearPesos } from '@/utils/moneda'

import type { ErrorTablero } from '../errores-tablero'
import { mensajesDeFinanzas } from '../errores-tablero'
import type { FiltrosFinanzas } from '../filtros-finanzas'
import { formatearPorcentaje, rotuloALaFecha, rotuloDelPeriodo } from '../formato-tablero'
import { useCorregirPagina } from '../hooks/use-corregir-pagina'
import type { OrdenFinanzas, TableroFinanzas as Finanzas } from '../tablero.types'
import { TablaEvolucionFinanzas, TablaProfesoresFinanzas } from './TablaFinanzas'
import { TarjetaIndicador, ValorIndicador } from './TarjetaIndicador'

/**
 * La sección "Finanzas" del tablero (HU-47): los cuatro números del período (lo cobrado, el margen
 * del centro, lo pagado a los profesores y lo que se les debe) y, debajo, la tabla por profesor
 * —que se reordena por cualquier columna— y la evolución de los últimos 6 meses.
 *
 * Todo lo que se ve lo calcula la API: el reparto de cada cobro, el margen y los saldos salen del
 * motor de liquidaciones y acá no se suma ni se ordena nada. El saldo a pagar es **a hoy**, no del
 * período, así que se rotula con la fecha, como el total adeudado de "General". Nunca hay un alumno
 * ni un pago puntual.
 */
export function TableroFinanzas({
  finanzas,
  filtros,
  enEspera,
  error,
  onOrdenar,
  onPagina,
}: {
  /** `null` mientras llega la primera respuesta. */
  finanzas: Finanzas | null
  filtros: FiltrosFinanzas
  enEspera: boolean
  /** El 400 de la API sobre los parámetros de la tabla (el del período va en el selector). */
  error: ErrorTablero | null
  onOrdenar: (columna: OrdenFinanzas) => void
  onPagina: (page: number) => void
}) {
  const mensajes = mensajesDeFinanzas(error)

  // Una página pasada del final: la API devuelve `data: []` con su `meta`, así que la tabla se
  // corrige sola a su última página.
  useCorregirPagina(finanzas?.profesores.meta, filtros.page, enEspera, onPagina)

  return (
    <div className="space-y-8">
      {mensajes.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive">
            {mensajes.map((mensaje) => (
              <p key={mensaje}>{mensaje}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {finanzas ? (
        <Resumen finanzas={finanzas} enEspera={enEspera} />
      ) : (
        <div
          role="status"
          aria-label="Cargando el resumen de finanzas"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="gap-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-8 w-24" />
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {finanzas ? (
          <TablaEvolucionFinanzas evolucion={finanzas.evolucion} enEspera={enEspera} />
        ) : (
          <Card className="gap-3 p-6" aria-busy aria-label="Cargando la evolución mensual">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Card>
        )}
        <TablaProfesoresFinanzas
          profesores={finanzas?.profesores ?? null}
          orden={filtros.orden}
          direccion={filtros.direccion}
          onOrdenar={onOrdenar}
          page={filtros.page}
          onPageChange={onPagina}
          enEspera={enEspera}
        />
      </div>
    </div>
  )
}

/**
 * Los cuatro números principales. Los tres primeros son del período; el saldo a pagar es a la fecha
 * `hoy`, sin período (la suma de los saldos positivos: un profesor con saldo negativo no lo resta).
 * El margen trae su porcentaje sobre lo cobrado y, si hay turnos cobrados que el sistema cerró sin
 * asistencia registrada, cuánto de él son: los dos los calcula la API.
 */
function Resumen({ finanzas, enEspera }: { finanzas: Finanzas; enEspera: boolean }) {
  const { resumen } = finanzas
  const { margenCentro, incluyeSinRegistrar } = resumen
  const delPeriodo = rotuloDelPeriodo(finanzas.periodo)

  return (
    <section
      aria-label="Resumen de finanzas"
      aria-busy={enEspera}
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <TarjetaIndicador titulo="Total cobrado" rotulo={delPeriodo}>
        <ValorIndicador destacado valor={formatearPesos(resumen.totalCobrado)} />
      </TarjetaIndicador>

      <TarjetaIndicador titulo="Margen del centro" rotulo={delPeriodo}>
        <ValorIndicador
          destacado
          valor={formatearPesos(margenCentro.importe)}
          detalle={`${formatearPorcentaje(margenCentro.porcentaje)} del total cobrado`}
        />
        {/* Un turno cobrado que el sistema cerró sin asistencia no se le debe al profesor: entra
            entero en el margen. La API dice cuánto de él es eso. */}
        {incluyeSinRegistrar > 0 && (
          <p className="text-muted-foreground -mt-2 text-xs">
            Incluye {formatearPesos(incluyeSinRegistrar)} de turnos sin asistencia registrada.
          </p>
        )}
      </TarjetaIndicador>

      <TarjetaIndicador titulo="Pagado a profesores" rotulo={delPeriodo}>
        <ValorIndicador destacado valor={formatearPesos(resumen.pagadoAProfesores)} />
        <p className="text-muted-foreground -mt-2 text-xs">
          Liquidaciones pagadas con fecha de transferencia en el período.
        </p>
      </TarjetaIndicador>

      {/* Lo que se les debe es a la fecha, no del período: no cambia con el período elegido. */}
      <TarjetaIndicador titulo="Saldo a pagar a profesores" rotulo={rotuloALaFecha(finanzas.hoy)}>
        <ValorIndicador destacado valor={formatearPesos(resumen.saldoAPagarAProfesores)} />
      </TarjetaIndicador>
    </section>
  )
}
