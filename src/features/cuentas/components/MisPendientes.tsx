'use client'

import { AlertCircle, CalendarClock, Wallet } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { fechaConAnio, fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import type { GrupoDeCuenta } from '../cuentas.types'
import { useMiCuenta } from '../hooks/use-mi-cuenta'

/**
 * Lo que el alumno tiene pendiente de pago, en "Mis pagos" del portal (HU-37, `GET
 * /cuentas/mi-cuenta`): el total adeudado y, aparte, los turnos adeudados y los próximos (hasta el
 * tope de cobro), cada uno agrupado por materia con su subtotal. Los importes y los totales son los
 * de la API, los mismos que ve la mesa de entrada; acá no se suma nada. De sólo lectura (se paga
 * en la mesa de entrada). Pensado para el celular: tarjetas, una debajo de la otra.
 */
export function MisPendientes() {
  const query = useMiCuenta()

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
          {query.error?.message ?? 'Ocurrió un error inesperado'}
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <div role="status" aria-label="Cargando tus pagos pendientes" className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const { totalAdeudado, adeudados, proximos, limiteCobro } = query.data
  if (adeudados.length === 0 && proximos.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState icon={Wallet} title="No tenés pagos pendientes" />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="gap-1">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Total adeudado
        </p>
        <p className="text-3xl font-bold tabular-nums">{formatearPesos(totalAdeudado)}</p>
        <p className="text-muted-foreground text-sm">
          La suma de tus turnos adeudados. Los próximos turnos no suman a la deuda.
        </p>
      </Card>

      {adeudados.length > 0 && (
        <SeccionPendiente id="mis-adeudados" titulo="Turnos adeudados" grupos={adeudados} />
      )}

      {proximos.length > 0 && (
        <SeccionPendiente
          id="mis-proximos"
          titulo="Próximos turnos"
          descripcion={`Podés pagarlos por adelantado hasta el ${fechaConAnio(limiteCobro)}.`}
          grupos={proximos}
        />
      )}
    </div>
  )
}

/** Una sección ("Turnos adeudados" o "Próximos turnos"): una tarjeta por materia. */
function SeccionPendiente({
  id,
  titulo,
  descripcion,
  grupos,
}: {
  id: string
  titulo: string
  descripcion?: string
  grupos: GrupoDeCuenta[]
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        {/* `h3`: la página pone el `h2` de la sección ("Pendiente de pago"). */}
        <h3 id={id} className="text-base font-semibold">
          {titulo}
        </h3>
        {descripcion && <p className="text-muted-foreground text-sm">{descripcion}</p>}
      </div>
      <ul className="space-y-3">
        {grupos.map((grupo) => (
          <li key={grupo.materia.id}>
            <TarjetaDeMateria grupo={grupo} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Una materia con su subtotal y sus turnos: fecha, horario, profesor e importe. */
function TarjetaDeMateria({ grupo }: { grupo: GrupoDeCuenta }) {
  const cantidad = grupo.ocurrencias.length
  return (
    <Card className="gap-0 p-0">
      <div className="border-border flex items-baseline justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{grupo.materia.nombre}</p>
          <p className="text-muted-foreground text-xs">
            {cantidad === 1 ? '1 turno' : `${cantidad} turnos`}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-muted-foreground block text-xs">Subtotal</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatearPesos(grupo.subtotal)}
          </span>
        </p>
      </div>
      <ul className="divide-border divide-y">
        {grupo.ocurrencias.map((o) => (
          <li
            key={`${o.turnoId}|${o.fecha}`}
            className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium first-letter:uppercase">{fechaConDia(o.fecha)}</p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                {rangoHoras(o.horaInicio, o.horaFin)} · {o.profesor.nombre} {o.profesor.apellido}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {o.importe === null ? 'Sin precio' : formatearPesos(o.importe)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
