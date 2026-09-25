import { AlertCircle, BookOpen } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

import type { MateriaAsignada } from '../profesores.types'
import { useMateriasAsignadas } from '../hooks/use-materias-asignadas'

type MateriasProfesorProps = {
  profesorId: number
}

// Sección "Materias" de la ficha del profesor. Por ahora solo lista las materias con asignación
// activa (GET /profesores/{id}/materias); asignar y quitar materias es el resto de T-12. Se
// muestra igual con el profesor inactivo: la API solo bloquea asignar, no leer.
export function MateriasProfesor({ profesorId }: MateriasProfesorProps) {
  const materias = useMateriasAsignadas(profesorId)

  return (
    <Card className="gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <BookOpen className="text-cobalto size-4" />
          Materias asignadas
          {materias.isSuccess && <Badge variant="secondary">{materias.data.length}</Badge>}
        </h2>
      </div>

      {materias.isLoading ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : materias.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {materias.error.status === 403
              ? 'No tenés permiso para ver las materias del profesor'
              : materias.error.status === 404
                ? 'No se encontró el profesor'
                : materias.error.message}
            {materias.error.status !== 403 && materias.error.status !== 404 && (
              <Button variant="outline" size="sm" onClick={() => materias.refetch()}>
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : materias.data && materias.data.length > 0 ? (
        <ListaDeMaterias materias={materias.data} />
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Sin materias asignadas"
          description="Todavía no tiene materias asignadas."
          className="py-10"
        />
      )}
    </Card>
  )
}

function ListaDeMaterias({ materias }: { materias: MateriaAsignada[] }) {
  return (
    <ul className="space-y-3">
      {materias.map((materia) => (
        <li key={materia.id} className="bg-canvas flex items-center gap-3 rounded-xl px-4 py-3">
          <span className="bg-cobalto/10 text-cobalto flex size-9 shrink-0 items-center justify-center rounded-lg">
            <BookOpen className="size-4" />
          </span>
          <span className="font-semibold">{materia.nombre}</span>
        </li>
      ))}
    </ul>
  )
}
