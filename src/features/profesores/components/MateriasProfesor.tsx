import { useState } from 'react'
import { AlertCircle, BookOpen, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

import type { MateriaAsignada, ProfesorDetalle } from '../profesores.types'
import { useMateriasAsignadas } from '../hooks/use-materias-asignadas'
import { AsignarMateriasDialog } from './AsignarMateriasDialog'
import { QuitarMateriasDialog } from './QuitarMateriasDialog'

type MateriasProfesorProps = {
  profesor: ProfesorDetalle
}

type DialogoAbierto = 'asignar' | 'quitar' | null

// Sección "Materias" de la ficha del profesor: sus materias con asignación activa, y los botones
// para asignar (POST /profesores/{id}/materias) y quitar (DELETE, baja lógica). Se muestra igual
// con el profesor inactivo: la API solo bloquea asignar, no leer ni quitar.
export function MateriasProfesor({ profesor }: MateriasProfesorProps) {
  const materias = useMateriasAsignadas(profesor.id)
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null)
  const nombreProfesor = `${profesor.nombre} ${profesor.apellido}`
  const asignadas = materias.data ?? []
  const activo = profesor.estado === 'ACTIVO'

  return (
    <Card className="gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <BookOpen className="text-cobalto size-4" />
          Materias asignadas
          {materias.isSuccess && <Badge variant="secondary">{materias.data.length}</Badge>}
        </h2>
        <div className="flex flex-wrap gap-2">
          {asignadas.length > 0 && (
            <Button variant="destructive" onClick={() => setDialogo('quitar')}>
              <Trash2 />
              Quitar materias
            </Button>
          )}
          {activo && (
            <Button onClick={() => setDialogo('asignar')}>
              <Plus />
              Asignar materias
            </Button>
          )}
        </div>
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
      ) : asignadas.length > 0 ? (
        <ListaDeMaterias materias={asignadas} />
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Sin materias asignadas"
          description="Todavía no tiene materias asignadas."
          className="py-10"
        />
      )}

      <AsignarMateriasDialog
        profesorId={profesor.id}
        nombreProfesor={nombreProfesor}
        asignadas={asignadas}
        open={dialogo === 'asignar'}
        onCerrar={() => setDialogo(null)}
      />
      <QuitarMateriasDialog
        profesorId={profesor.id}
        nombreProfesor={nombreProfesor}
        asignadas={asignadas}
        open={dialogo === 'quitar'}
        onCerrar={() => setDialogo(null)}
      />
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
