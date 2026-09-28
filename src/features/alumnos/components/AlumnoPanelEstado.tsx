'use client'

import { AlertCircle, SearchX } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiError } from '@/utils/fetch-json'

type AlumnoPanelEstadoProps = {
  mode: 'modal' | 'page'
  onCerrar: () => void
  titulo: string
} & (
  | { estado: 'cargando' }
  | { estado: 'no-encontrado' }
  | { estado: 'error'; error: ApiError | null; onReintentar: () => void }
)

// Lo que muestran el detalle y la edición mientras cargan o si el pedido falla, con el mismo
// encabezado que tendrán cuando lleguen los datos (docs/arquitectura-frontend.md → Manejo de errores).
export function AlumnoPanelEstado(props: AlumnoPanelEstadoProps) {
  const { mode, onCerrar, titulo } = props

  return (
    <Panel mode={mode} onClose={onCerrar}>
      <PanelHeader>
        <div>
          <PanelTitle>{titulo}</PanelTitle>
          <PanelDescription>
            {props.estado === 'cargando' ? 'Cargando datos del alumno…' : 'Datos del alumno'}
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>
        {props.estado === 'cargando' && (
          <div className="grid gap-5 sm:grid-cols-2" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </div>
        )}

        {props.estado === 'no-encontrado' && (
          <EmptyState
            icon={SearchX}
            title="Alumno no encontrado"
            description="Puede que el enlace sea incorrecto."
            className="py-10"
          >
            <Button variant="outline" onClick={onCerrar}>
              Volver al listado
            </Button>
          </EmptyState>
        )}

        {props.estado === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {props.error?.status === 403
                ? 'No tenés permiso para ver este alumno'
                : (props.error?.message ?? 'Ocurrió un error inesperado')}
              {props.error?.status !== 403 && (
                <Button variant="outline" size="sm" onClick={props.onReintentar}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </PanelBody>
    </Panel>
  )
}
