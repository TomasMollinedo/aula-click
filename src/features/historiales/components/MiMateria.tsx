'use client'

import { type ReactNode, useId, useState } from 'react'
import {
  AlertCircle,
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lightbulb,
} from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/utils/cn'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import { tituloBloque, tituloGrupo } from '../formato-historiales'
import type { BloqueDelPortal } from '../historiales.types'
import { useMesEnUrl } from '../hooks/use-mes-en-url'
import { useMiMateria } from '../hooks/use-mi-materia'
import { usePestanaMiMateria } from '../hooks/use-pestana-mi-materia'
import { moverMes, textosDelBloque, tituloDelMes } from '../mis-materias'
import { TextosHistorial } from './BloqueHistorial'

export type MiMateriaProps = {
  materiaId: number
  profesorId: number
  /** Los exámenes del alumno en la materia, que compone `app/portal` (`MisExamenes`, HU-35). */
  renderExamenes: (solicitud: { materiaId: number }) => ReactNode
}

/**
 * Una materia de "Mis materias" (HU-33), de sólo lectura y pensada para el celular: primero y
 * destacadas las "Indicaciones para la próxima clase"; debajo, dos pestañas (`?tab=`, como la ficha
 * del alumno): "Historial", el del mes (por defecto el actual, en `?mes=`) en bloques de horas
 * seguidas, de la más reciente a la más antigua, y "Exámenes" (`renderExamenes`). Todo lo decide la API (`GET /historiales/mis-materias/…`): los
 * bloques, sus textos una sola vez y el estado de cada hora.
 */
export function MiMateria({ materiaId, profesorId, renderExamenes }: MiMateriaProps) {
  const { mes, esActual, cambiar } = useMesEnUrl()
  const { pestana, cambiar: cambiarPestana } = usePestanaMiMateria()
  const query = useMiMateria(materiaId, profesorId, mes)
  const datos = query.data

  if (query.isError) {
    const noEncontrada = query.error?.status === 404
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
          {noEncontrada
            ? 'No encontramos esta materia entre las tuyas'
            : (query.error?.message ?? 'Ocurrió un error inesperado')}
          {!noEncontrada && (
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Reintentar
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (!datos) {
    return (
      <div role="status" aria-label="Cargando tu materia" className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{tituloGrupo(datos)}</h2>

      {datos.indicacionesProximaClase && (
        <section
          aria-labelledby="indicaciones-proxima-clase"
          className="border-dorado bg-dorado/10 rounded-xl border-l-4 p-4 sm:p-5"
        >
          <h3
            id="indicaciones-proxima-clase"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <Lightbulb aria-hidden className="text-dorado size-5 shrink-0" />
            Indicaciones para la próxima clase
          </h3>
          <p className="mt-2 whitespace-pre-line">{datos.indicacionesProximaClase.indicaciones}</p>
          <p className="text-muted-foreground mt-2 text-xs first-letter:uppercase">
            De la clase del {fechaConDia(datos.indicacionesProximaClase.fecha)}
          </p>
        </section>
      )}

      <Tabs value={pestana} onValueChange={cambiarPestana} className="space-y-4">
        <TabsList>
          <TabsTrigger value="historial" className="px-4">
            <BookMarked />
            Historial
          </TabsTrigger>
          <TabsTrigger value="examenes" className="px-4">
            <ClipboardList />
            Exámenes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historial">
          <Card className="gap-0 p-0">
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-6">
              <h3 className="text-base font-semibold">Historial</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mes anterior"
                  onClick={() => cambiar(moverMes(mes, -1))}
                >
                  <ChevronLeft />
                </Button>
                <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
                  {tituloDelMes(mes)}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mes siguiente"
                  disabled={esActual}
                  onClick={() => cambiar(moverMes(mes, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {datos.bloques.length === 0 ? (
              <EmptyState icon={BookOpen} title="No hay clases registradas en este mes" />
            ) : (
              <div
                aria-busy={query.isPlaceholderData}
                className={cn('space-y-3 p-4 sm:p-6', query.isPlaceholderData && 'opacity-60')}
              >
                {datos.bloques.map((bloque, i) => (
                  <BloqueMiMateria
                    key={`${bloque.fecha}-${bloque.horaInicio}`}
                    bloque={bloque}
                    abiertoAlEntrar={i === 0}
                  />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="examenes">{renderExamenes({ materiaId })}</TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Un bloque de horas seguidas del portal, desplegable para que el mes no quede tan largo en el
 * celular: cerrado, la fecha y el horario del bloque con el estado de cada hora; abierto, además
 * "Qué se trabajó" e indicaciones y una fila por hora. Los textos van una sola vez arriba si todas las
 * horas tienen los mismos; si alguna tiene otros, cada hora muestra los suyos (`textosDelBloque`).
 * El más reciente del mes entra abierto (`abiertoAlEntrar`). Sin enlaces: es de sólo lectura.
 */
function BloqueMiMateria({
  bloque,
  abiertoAlEntrar,
}: {
  bloque: BloqueDelPortal
  abiertoAlEntrar: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoAlEntrar)
  const idPanel = useId()
  const { arriba, porClase } = textosDelBloque(bloque)

  return (
    <section className="border-border rounded-lg border">
      <h4>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idPanel}
          onClick={() => setAbierto((actual) => !actual)}
          className="focus-visible:ring-ring hover:bg-canvas flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-2"
        >
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block text-sm font-semibold first-letter:uppercase">
              {tituloBloque(bloque)}
            </span>
            {/* Cerrado, los estados de sus horas: se ve de un vistazo si fue, faltó o se canceló. */}
            {!abierto && (
              <span className="flex flex-wrap gap-1.5">
                {bloque.clases.map((clase) => (
                  <EstadoTurnoBadge
                    key={`${clase.turnoId}-${clase.horaInicio}`}
                    estado={clase.estado}
                  />
                ))}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform',
              abierto && 'rotate-180',
            )}
          />
        </button>
      </h4>

      <div id={idPanel} hidden={!abierto}>
        {arriba && (
          <div className="px-4">
            <div className="border-border border-l-2 pl-3">
              <TextosHistorial textos={arriba} />
            </div>
          </div>
        )}

        <ul className="divide-border mt-3 divide-y border-t">
          {bloque.clases.map((clase, i) => {
            const textos = porClase[i]
            return (
              <li key={`${clase.turnoId}-${clase.horaInicio}`} className="space-y-2 px-4 py-3">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm font-medium tabular-nums">
                    {rangoHoras(clase.horaInicio, clase.horaFin)}
                  </span>
                  <EstadoTurnoBadge estado={clase.estado} />
                </span>
                {textos && (
                  <span className="border-border block border-l-2 pl-3">
                    <TextosHistorial textos={textos} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
