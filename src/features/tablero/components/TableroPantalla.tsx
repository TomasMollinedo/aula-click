'use client'

import { AlertCircle, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/utils/cn'

import { interpretarErrorTablero } from '../errores-tablero'
import { aParamsAsistencia } from '../filtros-asistencia'
import { useFiltrosAsistencia } from '../hooks/use-filtros-asistencia'
import { usePeriodoEnUrl } from '../hooks/use-periodo-en-url'
import { useSeccionEnUrl } from '../hooks/use-seccion-en-url'
import { useTablero } from '../hooks/use-tablero'
import { useTableroAsistencia } from '../hooks/use-tablero-asistencia'
import { ETIQUETA_SECCION, SECCIONES, type Seccion } from '../seccion'
import { BotonPdfTablero } from './BotonPdfTablero'
import { SelectorPeriodo } from './SelectorPeriodo'
import { TableroAsistencia } from './TableroAsistencia'
import { TableroGeneral } from './TableroGeneral'

/**
 * El tablero del gerente (`/gerente/tablero`, HU-21 y HU-39): indicadores del centro de un período,
 * de sólo lectura y sin enlaces, en dos pestañas ("General" y "Asistencia", `?seccion=`). El
 * selector de período está **arriba de las dos** y es común: cambiar de pestaña lo conserva, y
 * cambiarlo pide de nuevo la sección que se ve.
 *
 * Sólo se consulta la sección activa (la otra queda deshabilitada, no pide datos). Mientras llegan
 * los números nuevos se ven los anteriores atenuados, cada uno rotulado con el período que devolvió
 * la API. Los porcentajes, la ocupación y los rankings los calcula la API: la pantalla sólo dibuja.
 */
export function TableroPantalla() {
  const { periodo, elegir, cambiarRango } = usePeriodoEnUrl()
  const { seccion, cambiar } = useSeccionEnUrl()
  const { filtros, irAProfesores, irAMaterias, ordenarPor, cambiarSoloSinRegistrar } =
    useFiltrosAsistencia()

  const general = useTablero(periodo, seccion === 'general')
  const asistencia = useTableroAsistencia(
    aParamsAsistencia(periodo, filtros),
    seccion === 'asistencia',
  )

  const query = seccion === 'general' ? general : asistencia
  const error = query.isError ? interpretarErrorTablero(query.error) : null
  // Un 400 sobre el período deja el documento sin armar; uno sobre los parámetros de las tablas, no.
  const periodoValido = error?.tipo !== 'periodo'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SelectorPeriodo
          periodo={periodo}
          onElegir={elegir}
          onCambiarRango={cambiarRango}
          errores={error?.tipo === 'periodo' ? error.campos : undefined}
        />
        {/* El PDF es de la sección y el período que se ven; con un período inválido (400) la API no
            lo puede armar. */}
        <BotonPdfTablero periodo={periodoValido ? { ...periodo, seccion } : null} />
      </div>

      <Tabs
        value={seccion}
        onValueChange={(valor) => cambiar(valor as Seccion)}
        className="space-y-6"
      >
        <TabsList>
          {SECCIONES.map((valor) => (
            <TabsTrigger key={valor} value={valor} className="px-4">
              {ETIQUETA_SECCION[valor]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/*
          El error del período ya está junto a sus campos y el de los parámetros de las tablas lo
          muestra la sección "Asistencia", junto a ellas: los dos dejan `mensaje` en `null`. Acá
          queda el que no se pudo ubicar en ningún campo, el 403 y el genérico.
        */}
        {error?.mensaje && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
              {error.mensaje}
              {error.reintentar && (
                <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
                  <RotateCw />
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Sólo se monta la pestaña activa: la otra no pide datos. */}
        <TabsContent value="general">
          {general.isError ? null : general.data ? (
            <div
              aria-busy={general.isPlaceholderData}
              className={cn(
                'space-y-8 transition-opacity',
                general.isPlaceholderData && 'pointer-events-none opacity-50',
              )}
            >
              <TableroGeneral tablero={general.data} />
            </div>
          ) : (
            <CargandoTablero />
          )}
        </TabsContent>

        <TabsContent value="asistencia">
          {/* Un 400 sobre un parámetro de las tablas no tapa la sección: sale junto a ellas. */}
          {asistencia.isError && error?.tipo !== 'parametros' ? null : (
            <TableroAsistencia
              asistencia={asistencia.data ?? null}
              filtros={filtros}
              enEspera={asistencia.isPlaceholderData}
              error={error?.tipo === 'parametros' ? error : null}
              onOrdenar={ordenarPor}
              onPaginaProfesores={irAProfesores}
              onPaginaMaterias={irAMaterias}
              onSoloSinRegistrar={cambiarSoloSinRegistrar}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
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
