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
  nombreDeProfesor,
  rotuloALaFecha,
  rotuloDelPeriodo,
} from '../formato-tablero'
import { usePeriodoEnUrl } from '../hooks/use-periodo-en-url'
import { useTablero } from '../hooks/use-tablero'
import type { Tablero } from '../tablero.types'
import { BotonPdfTablero } from './BotonPdfTablero'
import { GraficoDona, ItemLeyenda } from './GraficoDona'
import { SelectorPeriodo } from './SelectorPeriodo'
import { TarjetaIndicador, ValorIndicador } from './TarjetaIndicador'
import { TarjetaRanking } from './TarjetaRanking'

/**
 * El tablero del gerente (`/gerente/tablero`, HU-21): indicadores del centro de un período, de solo
 * lectura y sin enlaces. Primero el dinero (lo que más se mira), después los turnos y la ocupación
 * con sus gráficos, y las materias. El período (`?periodo=`, "Esta semana" por defecto) va en la
 * URL; cambiarlo pide todo de nuevo, y mientras llegan los números nuevos se ven los anteriores
 * atenuados, cada uno rotulado con el período que devolvió la API. El total adeudado es a la fecha,
 * no del período. Los porcentajes, la ocupación y el top de materias los calcula la API; los
 * gráficos solo los dibujan.
 */
export function TableroPantalla() {
  const { periodo, elegir, cambiarRango } = usePeriodoEnUrl()
  const tablero = useTablero(periodo)
  const error = tablero.isError ? interpretarErrorTablero(tablero.error) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SelectorPeriodo
          periodo={periodo}
          onElegir={elegir}
          onCambiarRango={cambiarRango}
          errores={error?.tipo === 'periodo' ? error.campos : undefined}
        />
        {/* El PDF es del período que se ve; con uno inválido (400) la API no lo puede armar. */}
        <BotonPdfTablero periodo={error?.tipo === 'periodo' ? null : periodo} />
      </div>

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

function Indicadores({ tablero }: { tablero: Tablero }) {
  const { turnos, ocupacion, alumnos, pagos } = tablero
  // El período de la respuesta, no el elegido: lo que se ve es de ese período.
  const delPeriodo = rotuloDelPeriodo(tablero.periodo)
  // Lo que queda de la capacidad de las clases; si bajaron una capacidad y hay de más, 0.
  const lugaresLibres = Math.max(ocupacion.capacidad - ocupacion.turnos, 0)

  return (
    <>
      <Seccion titulo="Pagos">
        <div className="grid gap-4 sm:grid-cols-2">
          <TarjetaIndicador titulo="Total cobrado" rotulo={delPeriodo}>
            <ValorIndicador destacado valor={formatearPesos(pagos.totalCobrado)} />
          </TarjetaIndicador>
          {/* La deuda es a la fecha, de todos los alumnos: no cambia con el período. */}
          <TarjetaIndicador titulo="Total adeudado" rotulo={rotuloALaFecha(tablero.hoy)}>
            <ValorIndicador destacado valor={formatearPesos(pagos.totalAdeudado)} />
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Turnos y ocupación">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TarjetaIndicador titulo="Turnos del período" rotulo={delPeriodo}>
            {/* `ocupacion.turnos` son los no cancelados: junto a los cancelados, el total. */}
            <GraficoDona
              descripcion={`${formatearCantidad(turnos.total)} turnos, ${formatearCantidad(turnos.cancelados.cantidad)} cancelados`}
              centro={{ valor: formatearCantidad(turnos.total), texto: 'turnos' }}
              segmentos={[
                { etiqueta: 'Activos', valor: ocupacion.turnos, claseColor: 'stroke-cobalto' },
                {
                  etiqueta: 'Cancelados',
                  valor: turnos.cancelados.cantidad,
                  claseColor: 'stroke-cancelado',
                },
              ]}
            />
            <ul className="space-y-2">
              <ItemLeyenda
                claseColor="bg-cobalto"
                etiqueta="Activos"
                valor={formatearCantidad(ocupacion.turnos)}
              />
              <ItemLeyenda
                claseColor="bg-cancelado"
                etiqueta="Cancelados"
                valor={formatearCantidad(turnos.cancelados.cantidad)}
                detalle={formatearPorcentaje(turnos.cancelados.porcentaje)}
              />
            </ul>
          </TarjetaIndicador>

          <TarjetaIndicador titulo="Ocupación de las clases" rotulo={delPeriodo}>
            <p className="text-muted-foreground -mt-2 text-xs">
              Lugares ocupados y libres en las clases que tienen turnos.
            </p>
            {/* El anillo se llena hasta el 100 %; el número del centro es el real (puede superarlo). */}
            <GraficoDona
              descripcion={`Ocupación ${formatearPorcentaje(ocupacion.porcentaje)}: ${formatearCantidad(ocupacion.turnos)} lugares ocupados y ${formatearCantidad(lugaresLibres)} libres`}
              total={ocupacion.capacidad}
              centro={{ valor: formatearPorcentaje(ocupacion.porcentaje), texto: 'ocupado' }}
              segmentos={[
                {
                  etiqueta: 'Ocupados',
                  valor: Math.min(ocupacion.turnos, ocupacion.capacidad),
                  claseColor: 'stroke-cobalto',
                },
                { etiqueta: 'Libres', valor: lugaresLibres, claseColor: 'stroke-piedra' },
              ]}
            />
            <ul className="space-y-2">
              <ItemLeyenda
                claseColor="bg-cobalto"
                etiqueta="Lugares ocupados"
                valor={formatearCantidad(ocupacion.turnos)}
              />
              <ItemLeyenda
                claseColor="bg-piedra"
                etiqueta="Lugares libres"
                valor={formatearCantidad(lugaresLibres)}
              />
            </ul>
          </TarjetaIndicador>

          <TarjetaIndicador titulo="Alumnos nuevos" rotulo={delPeriodo}>
            <ValorIndicador destacado valor={formatearCantidad(alumnos.nuevos)} />
          </TarjetaIndicador>
        </div>
      </Seccion>

      <Seccion titulo="Materias y profesores">
        <div className="grid gap-4 lg:grid-cols-2">
          <TarjetaRanking
            titulo="Materias con más demanda"
            rotulo={delPeriodo}
            vacio="No hay turnos en este período."
            items={tablero.materiasConMasDemanda.map(({ materia, cantidad }) => ({
              clave: materia.id,
              nombre: materia.nombre,
              cantidad,
            }))}
          />
          <TarjetaRanking
            titulo="Profesores con más turnos"
            rotulo={delPeriodo}
            vacio="No hay turnos en este período."
            items={tablero.profesoresConMasTurnos.map(({ profesor, cantidad }) => ({
              clave: profesor.id,
              nombre: nombreDeProfesor(profesor),
              cantidad,
            }))}
          />
        </div>
      </Seccion>
    </>
  )
}

/** El esqueleto de las secciones mientras llega la primera respuesta. */
function CargandoTablero() {
  return (
    <div role="status" aria-label="Cargando el tablero" className="space-y-8">
      {[2, 3, 2].map((tarjetas, indice) => (
        <div key={indice} className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
