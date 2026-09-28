'use client'

import { AlertCircle, SearchX } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiError } from '@/utils/fetch-json'

/** Textos del panel: por defecto, los del profesor. El formulario de bloques pasa los suyos. */
type TextosPanelEstado = {
  descripcion: string
  cargando: string
  noEncontrado: string
  volver: string
  sinPermiso: string
}

const TEXTOS_PROFESOR: TextosPanelEstado = {
  descripcion: 'Datos del profesor',
  cargando: 'Cargando datos del profesor…',
  noEncontrado: 'Profesor no encontrado',
  volver: 'Volver al listado',
  sinPermiso: 'No tenés permiso para ver este profesor',
}

type ProfesorPanelEstadoProps = {
  mode: 'modal' | 'page'
  onCerrar: () => void
  titulo: string
  textos?: Partial<TextosPanelEstado>
} & (
  | { estado: 'cargando' }
  | { estado: 'no-encontrado' }
  | { estado: 'error'; error: ApiError | null; onReintentar: () => void }
)

// Lo que muestran el detalle y la edición mientras cargan o si el pedido falla, con el mismo
// encabezado que tendrán cuando lleguen los datos (docs/arquitectura-frontend.md → Manejo de errores).
export function ProfesorPanelEstado(props: ProfesorPanelEstadoProps) {
  const { mode, onCerrar, titulo } = props
  const textos = { ...TEXTOS_PROFESOR, ...props.textos }

  return (
    <Panel mode={mode} onClose={onCerrar}>
      <PanelHeader>
        <div>
          <PanelTitle>{titulo}</PanelTitle>
          <PanelDescription>
            {props.estado === 'cargando' ? textos.cargando : textos.descripcion}
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
            title={textos.noEncontrado}
            description="Puede que el enlace sea incorrecto."
            className="py-10"
          >
            <Button variant="outline" onClick={onCerrar}>
              {textos.volver}
            </Button>
          </EmptyState>
        )}

        {props.estado === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {props.error?.status === 403
                ? textos.sinPermiso
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
