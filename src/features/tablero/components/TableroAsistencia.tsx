'use client'

import { useId } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'

import type { ErrorTablero } from '../errores-tablero'
import { mensajesDeAsistencia } from '../errores-tablero'
import type { FiltrosAsistencia } from '../filtros-asistencia'
import {
  formatearCantidad,
  formatearPorcentaje,
  rotuloALaFecha,
  rotuloDelPeriodo,
  textoClasesCerradas,
} from '../formato-tablero'
import { useCorregirPagina } from '../hooks/use-corregir-pagina'
import type {
  Conteo,
  OrdenProfesores,
  ResumenAsistencia,
  TableroAsistencia as Asistencia,
} from '../tablero.types'
import { rotulosDeTorta } from '../torta-rotulos'
import { GraficoDona } from './GraficoDona'
import { TablaMateriasAsistencia, TablaProfesoresAsistencia } from './TablaAsistencia'
import { TarjetaIndicador, ValorIndicador } from './TarjetaIndicador'

/**
 * La sección "Asistencia" del tablero (HU-39): la torta de presentes, ausentes y sin registrar del
 * período, los profesores que todavía tienen clases por registrar y, debajo, las dos tablas
 * (profesores y materias), cada una con su propia página. La de profesores se reordena por
 * cualquier columna y se puede filtrar a los que tienen turnos sin registrar; ese filtro **no**
 * cambia el resumen ni la tabla de materias, que son siempre del período entero.
 *
 * Todo lo que se ve lo calcula la API: acá no se suman cifras, no se ordenan filas ni se recorta
 * ninguna página. Nunca hay un nombre de alumno.
 */
export function TableroAsistencia({
  asistencia,
  filtros,
  enEspera,
  error,
  onOrdenar,
  onPaginaProfesores,
  onPaginaMaterias,
  onSoloSinRegistrar,
}: {
  /** `null` mientras llega la primera respuesta. */
  asistencia: Asistencia | null
  filtros: FiltrosAsistencia
  enEspera: boolean
  /** El 400 de la API sobre los parámetros de las tablas (el del período va en el selector). */
  error: ErrorTablero | null
  onOrdenar: (columna: OrdenProfesores) => void
  onPaginaProfesores: (page: number) => void
  onPaginaMaterias: (page: number) => void
  onSoloSinRegistrar: (solo: boolean) => void
}) {
  const idFiltro = useId()
  const mensajes = mensajesDeAsistencia(error)

  // Una página pasada del final: la API devuelve `data: []` con su `meta`, así que cada tabla se
  // corrige sola a su última página, por separado.
  useCorregirPagina(
    asistencia?.profesores.meta,
    filtros.paginaProfesores,
    enEspera,
    onPaginaProfesores,
  )
  useCorregirPagina(asistencia?.materias.meta, filtros.paginaMaterias, enEspera, onPaginaMaterias)

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

      {asistencia ? (
        <Resumen asistencia={asistencia} enEspera={enEspera} />
      ) : (
        <div
          role="status"
          aria-label="Cargando el resumen de asistencia"
          className="grid gap-4 lg:grid-cols-[3fr_2fr]"
        >
          {[0, 1, 2].map((i) => (
            <Card key={i} className="gap-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-8 w-20" />
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <TablaProfesoresAsistencia
          profesores={asistencia?.profesores ?? null}
          orden={filtros.orden}
          direccion={filtros.direccion}
          onOrdenar={onOrdenar}
          page={filtros.paginaProfesores}
          onPageChange={onPaginaProfesores}
          enEspera={enEspera}
          filtro={
            <div className="flex items-center gap-2">
              <Checkbox
                id={idFiltro}
                checked={filtros.soloSinRegistrar}
                onCheckedChange={(marcado) => onSoloSinRegistrar(marcado === true)}
              />
              <Label htmlFor={idFiltro} className="font-normal">
                Sólo con turnos sin registrar
              </Label>
            </div>
          }
        />
        <TablaMateriasAsistencia
          materias={asistencia?.materias ?? null}
          page={filtros.paginaMaterias}
          onPageChange={onPaginaMaterias}
          enEspera={enEspera}
        />
      </div>
    </div>
  )
}

/**
 * Los números principales. La torta y los turnos cerrados por el sistema son del período entero,
 * sin el filtro de la tabla; los profesores sin registrar **no** dependen del período: son los que
 * tienen clases de los últimos 7 días sin marcar, a la fecha de la respuesta. Los colores y los
 * rótulos de la torta son los de los badges de estado del turno.
 */
function Resumen({ asistencia, enEspera }: { asistencia: Asistencia; enEspera: boolean }) {
  const { resumen } = asistencia
  const { cerrados, total, clasesCerradas } = resumen
  const delPeriodo = rotuloDelPeriodo(asistencia.periodo)

  return (
    <section
      aria-label="Resumen de asistencia"
      aria-busy={enEspera}
      className="grid gap-4 lg:grid-cols-[2fr_1fr]"
    >
      <TarjetaIndicador
        titulo="Asistencia del centro"
        rotulo={delPeriodo}
        className="lg:row-span-2"
      >
        <TortaDeAsistencia resumen={resumen} />
        <div className="border-border space-y-1 border-t pt-4">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Total de turnos</span>
            <span className="text-base font-semibold tabular-nums">{formatearCantidad(total)}</span>
          </p>
          <p className="text-muted-foreground text-xs">
            «Sin registrar» son los que el profesor todavía puede marcar (tiene 7 días desde la
            clase). «Cerrados» son los que el sistema cerró pasado ese plazo.
          </p>
        </div>
      </TarjetaIndicador>

      <TarjetaIndicador titulo="Cerrados por el sistema" rotulo={delPeriodo}>
        <ValorIndicador
          destacado
          valor={formatearCantidad(cerrados.cantidad)}
          detalle={
            clasesCerradas
              ? `Son ${textoClasesCerradas(clasesCerradas)}.`
              : 'El sistema no cerró ningún turno en este período.'
          }
        />
      </TarjetaIndicador>

      <TarjetaIndicador titulo="Profesores sin registrar" rotulo={rotuloALaFecha(asistencia.hoy)}>
        <ValorIndicador destacado valor={formatearCantidad(resumen.profesoresSinRegistrar)} />
        <p className="text-muted-foreground -mt-2 text-xs">
          Profesores con clases de los últimos 7 días sin la asistencia marcada: todavía están a
          tiempo de registrarla. No cambia con el período elegido.
        </p>
      </TarjetaIndicador>
    </section>
  )
}

type PartesDeLaTorta = {
  etiqueta: string
  variante: 'estadoRealizado' | 'estadoAusente' | 'estadoSinRegistrar' | 'estadoCerrado'
  claseColor: string
  conteo: Conteo
}

/** El ancho que se reserva a cada lado de la torta para sus rótulos, en píxeles. */
const SEPARACION_ROTULO = 108

/** Lo que mide la torta (`size-44`), en píxeles, más un margen. */
const ALTO_TORTA = 192

/**
 * La torta con cada rótulo (el badge del estado, el porcentaje y la cantidad) pegado a su porción,
 * unido por una línea, para saber de un vistazo cuál es cuál. En pantallas chicas, donde no hay
 * lugar a los costados, los rótulos van en una lista debajo.
 */
function TortaDeAsistencia({ resumen }: { resumen: ResumenAsistencia }) {
  const partes: PartesDeLaTorta[] = [
    {
      etiqueta: 'Presentes',
      variante: 'estadoRealizado',
      claseColor: 'stroke-estado-realizado-borde',
      conteo: resumen.presentes,
    },
    {
      etiqueta: 'Ausentes',
      variante: 'estadoAusente',
      claseColor: 'stroke-estado-ausente-borde',
      conteo: resumen.ausentes,
    },
    {
      etiqueta: 'Sin registrar',
      variante: 'estadoSinRegistrar',
      claseColor: 'stroke-estado-sin-registrar-borde',
      conteo: resumen.sinRegistrar,
    },
    {
      etiqueta: 'Cerrados',
      variante: 'estadoCerrado',
      claseColor: 'stroke-estado-sin-registrar',
      conteo: resumen.cerrados,
    },
  ]
  const { rotulos, alto: altoRotulos } = rotulosDeTorta(partes.map(({ conteo }) => conteo.cantidad))
  // Sin turnos no hay rótulos y `altoRotulos` es el de uno solo: el contenedor tiene que alcanzar al
  // menos para la torta, o se superpone con la lista de partes sin porción.
  const alto = Math.max(altoRotulos, ALTO_TORTA)
  const sinPorcion = partes.filter(({ conteo }) => conteo.cantidad === 0)

  const torta = (
    <GraficoDona
      className="size-44"
      descripcion={partes
        .map(({ etiqueta, conteo }) => `${formatearCantidad(conteo.cantidad)} ${etiqueta}`)
        .join(', ')}
      segmentos={partes.map(({ etiqueta, conteo, claseColor }) => ({
        etiqueta,
        valor: conteo.cantidad,
        claseColor,
      }))}
    />
  )

  return (
    <>
      {/* Con lugar a los costados: la torta en el medio y los rótulos alrededor. */}
      <div className="hidden sm:block">
        <div className="relative mx-auto w-full" style={{ height: alto }}>
          <svg aria-hidden className="absolute inset-0 size-full overflow-visible">
            <g style={{ transform: 'translate(50%, 50%)' }}>
              {rotulos.map(({ indice, lado, y, borde }) => (
                <line
                  key={indice}
                  x1={borde.x}
                  y1={borde.y}
                  x2={(lado === 'derecha' ? 1 : -1) * (SEPARACION_ROTULO - 8)}
                  y2={y}
                  className="stroke-border"
                  strokeWidth={1}
                />
              ))}
            </g>
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{torta}</div>
          {rotulos.map(({ indice, lado, y }) => {
            const parte = partes[indice] as PartesDeLaTorta
            return (
              <div
                key={indice}
                className={cn(
                  'absolute flex w-32 -translate-y-1/2 flex-col gap-1',
                  lado === 'derecha' ? 'items-start text-left' : 'items-end text-right',
                )}
                style={{
                  top: `calc(50% + ${y}px)`,
                  ...(lado === 'derecha'
                    ? { left: `calc(50% + ${SEPARACION_ROTULO}px)` }
                    : { right: `calc(50% + ${SEPARACION_ROTULO}px)` }),
                }}
              >
                <Badge variant={parte.variante}>{parte.etiqueta}</Badge>
                <ValorDeParte conteo={parte.conteo} />
              </div>
            )
          })}
        </div>
        {sinPorcion.length > 0 && (
          <ul className="text-muted-foreground mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
            {sinPorcion.map(({ etiqueta, variante }) => (
              <li key={etiqueta} className="flex items-center gap-1.5">
                <Badge variant={variante}>{etiqueta}</Badge>
                <span className="tabular-nums">0 turnos</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sin lugar a los costados: la torta y, debajo, la lista. */}
      <div className="space-y-4 sm:hidden">
        <div className="flex justify-center">{torta}</div>
        <ul className="space-y-2">
          {partes.map(({ etiqueta, variante, conteo }) => (
            <li key={etiqueta} className="flex items-center justify-between gap-3">
              <Badge variant={variante}>{etiqueta}</Badge>
              <ValorDeParte conteo={conteo} />
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

/** El porcentaje de una parte, bien visible, con su cantidad al lado. */
function ValorDeParte({ conteo }: { conteo: Conteo }) {
  return (
    <p className="tabular-nums">
      <span className="text-2xl font-semibold">{formatearPorcentaje(conteo.porcentaje)}</span>
      <span className="text-muted-foreground ml-1.5 text-sm">
        {formatearCantidad(conteo.cantidad)}
      </span>
    </p>
  )
}
