'use client'

import { AlertCircle, CalendarClock, FileText } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

import { fechaExamen, textoDiasRestantes } from '../formato-examenes'
import { useMisExamenes } from '../hooks/use-mis-examenes'
import { BadgeNota } from './BadgeNota'

export type MisExamenesProps = {
  materiaId: number
}

/**
 * La sección "Exámenes" de una materia del portal (HU-35), de sólo lectura: el próximo con los días
 * que faltan ("en 5 días", "hoy") y los rendidos con su resultado. Todo lo manda la API
 * (`GET /examenes/mis-examenes`): los días y el orden no se calculan acá. La API manda también el
 * promedio de la materia, que el equipo decidió no mostrar (15/10).
 */
export function MisExamenes({ materiaId }: MisExamenesProps) {
  const query = useMisExamenes(materiaId)
  const datos = query.data

  return (
    // Sin título propio: va en la pestaña "Exámenes" de la materia.
    <Card className="gap-0 p-0">
      {query.isError ? (
        <div className="p-4 sm:p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {query.error?.message ?? 'Ocurrió un error inesperado'}
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : !datos ? (
        <div role="status" aria-label="Cargando tus exámenes" className="space-y-3 p-4 sm:p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : datos.proximo === null && datos.rendidos.length === 0 ? (
        <EmptyState icon={FileText} title="No hay exámenes cargados en esta materia" />
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          {datos.proximo && (
            <section aria-labelledby="proximo-examen" className="bg-canvas rounded-lg p-4">
              <h4 id="proximo-examen" className="text-muted-foreground text-xs font-medium">
                Próximo examen
              </h4>
              <p className="mt-1 flex flex-wrap items-center gap-2 font-semibold">
                <span className="first-letter:uppercase">{fechaExamen(datos.proximo.fecha)}</span>
                <Badge variant="urgente">
                  <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                  {textoDiasRestantes(datos.proximo.diasRestantes)}
                </Badge>
              </p>
            </section>
          )}

          {datos.rendidos.length > 0 && (
            <section aria-labelledby="examenes-rendidos" className="space-y-2">
              <h4 id="examenes-rendidos" className="text-sm font-semibold">
                Rendidos
              </h4>
              <ul className="divide-border border-border divide-y rounded-lg border">
                {datos.rendidos.map((examen) => (
                  <li
                    key={examen.fecha}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 text-sm font-medium first-letter:uppercase">
                      {fechaExamen(examen.fecha)}
                    </span>
                    <BadgeNota resultado={examen.resultado} nota={examen.nota} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  )
}
