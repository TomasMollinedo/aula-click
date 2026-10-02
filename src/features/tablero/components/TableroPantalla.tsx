'use client'

import type { ReactNode } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'
import { formatearPesos } from '@/utils/moneda'

import { interpretarErrorTablero } from '../errores-tablero'
import {
  formatearCantidad,
  formatearPorcentaje,
  rotuloALaFecha,
  rotuloDelPeriodo,
} from '../formato-tablero'
import { usePeriodoEnUrl } from '../hooks/use-periodo-en-url'
import { useTablero } from '../hooks/use-tablero'
import type { Conteo, Tablero } from '../tablero.types'
import { SelectorPeriodo } from './SelectorPeriodo'
import { IndicadorNoDisponible, TarjetaIndicador, ValorIndicador } from './TarjetaIndicador'
import { TarjetaMaterias } from './TarjetaMaterias'

const GRILLA = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'

/**
 * El tablero del gerente (`/gerente/tablero`, HU-21): indicadores del centro de un período, de solo
 * lectura y sin enlaces. El período (`?periodo=`, "Esta semana" por defecto) va en la URL; cambiarlo
 * pide todo de nuevo, y mientras llegan los números nuevos se ven los anteriores atenuados, cada uno
 * rotulado con el período que devolvió la API. Cada indicador dice a qué corresponde: el total
 * adeudado es a la fecha, no del período. Los que dependen de la asistencia (`disponible: false`) no
 * llevan número. Los porcentajes, la ocupación y el top de materias los calcula la API.
 */
export function TableroPantalla() {
  const { periodo, elegir, cambiarRango } = usePeriodoEnUrl()
  const tablero = useTablero(periodo)
  const error = tablero.isError ? interpretarErrorTablero(tablero.error) : null

  return (
    <div className="space-y-6">
      <SelectorPeriodo
        periodo={periodo}
        onElegir={elegir}
        onCambiarRango={cambiarRango}
        errores={error?.tipo === 'periodo' ? error.campos : undefined}
      />

      {error ? (
        // El error del período ya está junto a sus campos; si no se pudo ubicar, queda el general.
        (error.tipo !== 'periodo' || error.mensaje) && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
              {error.mensaje}
              {error.reintentar && (
                <Button type="button" size="sm" variant="outline" onClick={() => tablero.refetch()}>
                  <RotateCw />
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )
      ) : tablero.data ? (
        <div
          aria-busy={tablero.isPlaceholderData}
          className={cn(
            'space-y-8 transition-opacity',
            tablero.isPlaceholderData && 'pointer-events-none opacity-50',
          )}
        >
          <Indicadores tablero={tablero.data} />
        </div>
      ) : (
        <CargandoTablero />
      )}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

/** Un indicador de turnos por estado: la cantidad y su porcentaje sobre el total del período. */
function TarjetaConteo({
  titulo,
  rotulo,
  conteo,
}: {
  titulo: string
  rotulo: string
  conteo: Conteo
}) {
  return (
    <TarjetaIndicador titulo={titulo} rotulo={rotulo}>
      <ValorIndicador
        valor={formatearCantidad(conteo.cantidad)}
        detalle={`${formatearPorcentaje(conteo.porcentaje)} del total`}
      />
    </TarjetaIndicador>
  )
}

function Indicadores({ tablero }: { tablero: Tablero }) {
  const { turnos, ocupacion, alumnos, pagos } = tablero
  // El período de la respuesta, no el elegido: lo que se ve es de ese período.
  const delPeriodo = rotuloDelPeriodo(tablero.periodo)

  return (
    <>
      <Seccion titulo="Turnos">
        <div className={GRILLA}>
          <TarjetaIndicador titulo="Turnos del período" rotulo={delPeriodo}>
            <ValorIndicador
              valor={formatearCantidad(turnos.total)}
              detalle="Incluye los cancelados"
            />
          </TarjetaIndicador>
          <TarjetaConteo titulo="Cancelados" rotulo={delPeriodo} conteo={turnos.cancelados} />
          <TarjetaConteo titulo="Sin registrar" rotulo={delPeriodo} conteo={turnos.sinRegistrar} />
          {/* `null`: el período no incluye fechas futuras y el indicador no se muestra. */}
          {turnos.agendados !== null && (
            <TarjetaConteo titulo="Agendados" rotulo={delPeriodo} conteo={turnos.agendados} />
          )}
          <TarjetaIndicador titulo="Asistió" rotulo={delPeriodo}>
            <IndicadorNoDisponible />
          </TarjetaIndicador>
          <TarjetaIndicador titulo="No asistió" rotulo={delPeriodo}>
            <IndicadorNoDisponible />
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Ocupación y alumnos">
        <div className={GRILLA}>
          <TarjetaIndicador titulo="Ocupación" rotulo={delPeriodo}>
            <ValorIndicador
              valor={formatearPorcentaje(ocupacion.porcentaje)}
              detalle={`${formatearCantidad(ocupacion.turnos)} turnos de ${formatearCantidad(ocupacion.capacidad)} lugares`}
            />
          </TarjetaIndicador>
          <TarjetaIndicador titulo="Alumnos nuevos" rotulo={delPeriodo}>
            <ValorIndicador valor={formatearCantidad(alumnos.nuevos)} />
          </TarjetaIndicador>
          <TarjetaIndicador titulo="Alumnos atendidos" rotulo={delPeriodo}>
            <IndicadorNoDisponible />
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Materias y profesores">
        <div className="grid gap-4 lg:grid-cols-2">
          <TarjetaMaterias materias={tablero.materiasConMasDemanda} rotulo={delPeriodo} />
          <TarjetaIndicador titulo="Profesores con más actividad" rotulo={delPeriodo}>
            <IndicadorNoDisponible />
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Pagos">
        <div className="grid gap-4 sm:grid-cols-2">
          <TarjetaIndicador titulo="Total cobrado" rotulo={delPeriodo}>
            <ValorIndicador valor={formatearPesos(pagos.totalCobrado)} />
          </TarjetaIndicador>
          {/* La deuda es a la fecha, de todos los alumnos: no cambia con el período. */}
          <TarjetaIndicador titulo="Total adeudado" rotulo={rotuloALaFecha(tablero.hoy)}>
            <ValorIndicador valor={formatearPesos(pagos.totalAdeudado)} />
          </TarjetaIndicador>
        </div>
      </Seccion>
    </>
  )
}

/** El esqueleto de las cuatro secciones mientras llega la primera respuesta. */
function CargandoTablero() {
  return (
    <div role="status" aria-label="Cargando el tablero" className="space-y-8">
      {[6, 3, 2, 2].map((tarjetas, indice) => (
        <div key={indice} className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <div className={GRILLA}>
            {Array.from({ length: tarjetas }, (_, i) => (
              <Card key={i} className="gap-3 p-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-8 w-24" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
