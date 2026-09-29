'use client'

import { AlertCircle, SearchX } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

import { useEditarMateria } from '../hooks/use-editar-materia'
import { useMateria } from '../hooks/use-materia'
import { detalleAValoresForm } from '../materias.schema'
import { MateriaForm } from './MateriaForm'

type MateriaEditarProps = {
  /** `editar` de la URL ya parseado; `null` si no era un id válido (se muestra "no encontrada"). */
  materiaId: number | null
  mode: 'modal' | 'page'
  onCerrar: () => void
  onGuardada: () => void
}

const TITULO = 'Editar materia'

// Edición de nombre, precio y descripción (HU-12), con las mismas validaciones del alta. Se abre
// desde "Editar" del detalle, como `?editar=<id>` sobre el listado. También carga el precio de
// una materia "Sin precio", que después se puede reactivar.
export function MateriaEditar({ materiaId, mode, onCerrar, onGuardada }: MateriaEditarProps) {
  const { data: materia, isLoading, error, refetch } = useMateria(materiaId ?? 0)
  const mutation = useEditarMateria(materiaId ?? 0)
  const toast = useToast()

  if (materiaId !== null && materia) {
    return (
      <Panel mode={mode} onClose={onCerrar} dismissOnInteractOutside={false}>
        <PanelHeader>
          <div>
            <PanelTitle>
              {TITULO} — {materia.nombre}
            </PanelTitle>
            <PanelDescription>Los campos con * son obligatorios</PanelDescription>
          </div>
        </PanelHeader>
        <MateriaForm
          defaultValues={detalleAValoresForm(materia)}
          onSubmit={(datos) =>
            mutation.mutate(datos, {
              onSuccess: (actualizada) => {
                toast.success(`Se guardaron los cambios de ${actualizada.nombre}`)
                onGuardada()
              },
            })
          }
          onCancelar={onCerrar}
          isPending={mutation.isPending}
          error={mutation.error}
        />
      </Panel>
    )
  }

  const noEncontrada = materiaId === null || error?.status === 404

  return (
    <Panel mode={mode} onClose={onCerrar}>
      <PanelHeader>
        <div>
          <PanelTitle>{TITULO}</PanelTitle>
          <PanelDescription>
            {isLoading ? 'Cargando datos de la materia…' : 'Datos de la materia'}
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>
        {noEncontrada ? (
          <EmptyState
            icon={SearchX}
            title="Materia no encontrada"
            description="Puede que el enlace sea incorrecto."
            className="py-10"
          >
            <Button variant="outline" onClick={onCerrar}>
              Volver al listado
            </Button>
          </EmptyState>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {error.status === 403
                ? 'No tenés permiso para ver esta materia'
                : (error.message ?? 'Ocurrió un error inesperado')}
              {error.status !== 403 && (
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  )
}
