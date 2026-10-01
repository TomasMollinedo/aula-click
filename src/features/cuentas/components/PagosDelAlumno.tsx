'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SolicitudRegistrarPago } from '@/types/pago'

import { aCobrar } from '../a-cobrar'
import { interpretarErrorCuenta } from '../errores-cuentas'
import { useCuentaDelAlumno } from '../hooks/use-cuenta-del-alumno'
import { useDialogoDePago } from '../hooks/use-dialogo-de-pago'
import {
  SELECCION_VACIA,
  type Seleccion,
  alternar,
  ordenarComoSeMuestran,
  podar,
  quitarTodos,
  resumenSeleccion,
  seleccionarTodos,
} from '../seleccion'
import { BarraSeleccion } from './BarraSeleccion'
import { HistorialPagos } from './HistorialPagos'
import { OcurrenciasTabla } from './OcurrenciasTabla'
import { TotalDestacado } from './TotalDestacado'

export type PagosDelAlumnoProps = {
  alumnoId: number
  /**
   * El diálogo de registrar un pago. Lo compone `app/` (es de `features/pagos`): recibe lo que
   * necesita `RegistrarPagoDialog`.
   */
  renderRegistrarPago: (pago: SolicitudRegistrarPago) => ReactNode
}

/**
 * Pestaña "Pagos" de la ficha del alumno (HU-16): total adeudado y pagado del mes, turnos adeudados
 * y próximos con una sola selección para cobrarlos juntos, e historial de pagos. Importes y totales
 * los manda la API; el cliente solo suma lo tildado (`resumenSeleccion`).
 *
 * La selección se poda en cada render contra la cuenta actual (lo cobrado o cancelado desaparece de
 * ella) y se guarda podada al cerrar el diálogo, que recibe su propia copia al abrirse
 * (`useDialogoDePago`).
 */
export function PagosDelAlumno({ alumnoId, renderRegistrarPago }: PagosDelAlumnoProps) {
  const query = useCuentaDelAlumno(alumnoId)
  const [marcada, setMarcada] = useState<Seleccion>(SELECCION_VACIA)

  // Adeudados y después próximos, cada uno en el orden de la API: así se muestran y así se cobran.
  const mostrada = useMemo(
    () => (query.data ? [...query.data.adeudados, ...query.data.proximos] : []),
    [query.data],
  )
  const seleccion = useMemo(() => podar(marcada, mostrada), [marcada, mostrada])
  const resumen = useMemo(() => resumenSeleccion(seleccion), [seleccion])

  const {
    abrir: abrirDialogo,
    refugioRef,
    dialogo,
  } = useDialogoDePago<HTMLHeadingElement>({
    renderRegistrarPago,
    alCerrar: () => setMarcada((actual) => podar(actual, mostrada)),
  })

  if (query.isPending) return <PagosDelAlumnoCargando />

  if (query.isError) {
    const { mensaje, reintentar } = interpretarErrorCuenta(query.error)
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
          {mensaje}
          {reintentar && (
            <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
              <RotateCw />
              Reintentar
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  const cuenta = query.data
  return (
    <div className="space-y-6">
      <Card className="grid gap-6 sm:grid-cols-2">
        <TotalDestacado etiqueta="Total adeudado" importe={cuenta.totalAdeudado} />
        <TotalDestacado etiqueta="Pagado este mes" importe={cuenta.pagadoDelMes} />
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <BarraSeleccion
          className="border-border border-b px-6 py-4"
          resumen={resumen}
          onSeleccionarTodos={() =>
            setMarcada((actual) => seleccionarTodos(podar(actual, mostrada), cuenta.adeudados))
          }
          seleccionarTodosDeshabilitado={cuenta.adeudados.length === 0}
          onQuitar={() => setMarcada(quitarTodos())}
          onRegistrar={(boton) =>
            abrirDialogo(
              { alumnoId, ocurrencias: ordenarComoSeMuestran(seleccion, mostrada) },
              boton,
            )
          }
        />

        <section aria-labelledby="cuenta-adeudados">
          <h2
            id="cuenta-adeudados"
            ref={refugioRef}
            tabIndex={-1}
            className="px-6 pt-6 pb-3 text-base font-semibold outline-none"
          >
            Turnos adeudados
          </h2>
          {cuenta.adeudados.length === 0 ? (
            <SinFilas>Sin turnos adeudados</SinFilas>
          ) : (
            <OcurrenciasTabla
              etiqueta="Turnos adeudados"
              filas={cuenta.adeudados}
              conEstado
              seleccion={seleccion}
              onAlternar={(fila) => setMarcada((actual) => alternar(podar(actual, mostrada), fila))}
              onCobrar={(fila, boton) =>
                abrirDialogo({ alumnoId, ocurrencias: [aCobrar(fila)] }, boton)
              }
            />
          )}
        </section>

        <section aria-labelledby="cuenta-proximos" className="border-border border-t">
          <h2 id="cuenta-proximos" className="px-6 pt-6 pb-3 text-base font-semibold">
            Próximos turnos
          </h2>
          {cuenta.proximos.length === 0 ? (
            <SinFilas>Sin próximos turnos para cobrar</SinFilas>
          ) : (
            <OcurrenciasTabla
              etiqueta="Próximos turnos"
              filas={cuenta.proximos}
              seleccion={seleccion}
              onAlternar={(fila) => setMarcada((actual) => alternar(podar(actual, mostrada), fila))}
              onCobrar={(fila, boton) =>
                abrirDialogo({ alumnoId, ocurrencias: [aCobrar(fila)] }, boton)
              }
            />
          )}
        </section>
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <section aria-labelledby="cuenta-pagos">
          <h2 id="cuenta-pagos" className="px-6 pt-6 pb-3 text-base font-semibold">
            Pagos registrados
          </h2>
          {cuenta.pagos.length === 0 ? (
            <SinFilas>Sin pagos registrados</SinFilas>
          ) : (
            <HistorialPagos pagos={cuenta.pagos} />
          )}
        </section>
      </Card>

      {dialogo}
    </div>
  )
}

function SinFilas({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground px-6 pb-6 text-sm">{children}</p>
}

/** La forma de la pantalla mientras llega la cuenta. */
function PagosDelAlumnoCargando() {
  return (
    <div className="space-y-6" aria-busy aria-label="Cargando los pagos del alumno">
      <Card className="grid gap-6 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </Card>
      <Card className="gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="mt-3 h-5 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Card>
      <Card className="gap-3">
        <Skeleton className="h-5 w-40" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Card>
    </div>
  )
}
