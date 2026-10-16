'use client'

import { useEffect, useId, useRef } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import type { ErrorTablero } from '../errores-tablero'
import { mensajesDeAsistencia } from '../errores-tablero'
import type { FiltrosAsistencia } from '../filtros-asistencia'
import {
  formatearCantidad,
  formatearPorcentaje,
  rotuloALaFecha,
  rotuloDelPeriodo,
} from '../formato-tablero'
import type { OrdenProfesores, TableroAsistencia as Asistencia } from '../tablero.types'
import { GraficoDona, ItemLeyenda } from './GraficoDona'
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
          className="grid gap-4 md:grid-cols-2"
        >
          {[0, 1].map((i) => (
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
 * Los números principales: la torta es siempre del período entero, sin el filtro de la tabla. Los
 * profesores sin registrar **no** dependen del período: son los que tienen clases de los últimos 7
 * días sin marcar, a la fecha de la respuesta.
 */
function Resumen({ asistencia, enEspera }: { asistencia: Asistencia; enEspera: boolean }) {
  const { resumen } = asistencia
  const { presentes, ausentes, sinRegistrar } = resumen

  return (
    <section
      aria-label="Resumen de asistencia"
      aria-busy={enEspera}
      className="grid gap-4 md:grid-cols-2"
    >
      <TarjetaIndicador
        titulo="Asistencia del centro"
        rotulo={rotuloDelPeriodo(asistencia.periodo)}
      >
        <GraficoDona
          descripcion={`${formatearCantidad(presentes.cantidad)} presentes, ${formatearCantidad(ausentes.cantidad)} ausentes y ${formatearCantidad(sinRegistrar.cantidad)} sin registrar`}
          centro={{ valor: formatearPorcentaje(presentes.porcentaje), texto: 'presentes' }}
          segmentos={[
            {
              etiqueta: 'Presentes',
              valor: presentes.cantidad,
              claseColor: 'stroke-estado-realizado',
            },
            {
              etiqueta: 'Ausentes',
              valor: ausentes.cantidad,
              claseColor: 'stroke-estado-ausente',
            },
            {
              etiqueta: 'Sin registrar',
              valor: sinRegistrar.cantidad,
              claseColor: 'stroke-estado-sin-registrar',
            },
          ]}
        />
        <ul className="space-y-2">
          <ItemLeyenda
            claseColor="bg-estado-realizado"
            etiqueta="Presentes"
            valor={formatearCantidad(presentes.cantidad)}
            detalle={formatearPorcentaje(presentes.porcentaje)}
          />
          <ItemLeyenda
            claseColor="bg-estado-ausente"
            etiqueta="Ausentes"
            valor={formatearCantidad(ausentes.cantidad)}
            detalle={formatearPorcentaje(ausentes.porcentaje)}
          />
          <ItemLeyenda
            claseColor="bg-estado-sin-registrar"
            etiqueta="Sin registrar"
            valor={formatearCantidad(sinRegistrar.cantidad)}
            detalle={formatearPorcentaje(sinRegistrar.porcentaje)}
          />
        </ul>
        <p className="text-muted-foreground text-xs">
          «Sin registrar» son los turnos que cerró el sistema porque pasaron los 7 días que tiene el
          profesor para marcar la asistencia.
        </p>
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

/**
 * Si la página que se pide quedó pasada del final (se filtró, se cambió el período o se llegó por
 * un enlace), vuelve a la última que existe. Mira sólo respuestas frescas: con la anterior
 * atenuada (`enEspera`) la `meta` todavía es la de la otra consulta.
 */
function useCorregirPagina(
  meta: { totalPages: number } | undefined,
  page: number,
  enEspera: boolean,
  onPageChange: (page: number) => void,
) {
  const totalPages = enEspera ? undefined : meta?.totalPages
  const corregir = useRef(onPageChange)
  useEffect(() => {
    corregir.current = onPageChange
  })
  useEffect(() => {
    if (totalPages === undefined) return
    const ultima = Math.max(1, totalPages)
    if (page > ultima) corregir.current(ultima)
  }, [totalPages, page])
}
