'use client'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { useToast } from '@/hooks/use-toast'

import { detalleAValoresForm, parsearProfesorId } from '../profesores.schema'
import { useEditarProfesor } from '../hooks/use-editar-profesor'
import { useProfesor } from '../hooks/use-profesor'
import { ProfesorForm } from './ProfesorForm'
import { ProfesorPanelEstado } from './ProfesorPanelEstado'

type ProfesorEditarProps = {
  /** `profesorId` tal como llega en la URL. */
  profesorId: string
  mode: 'modal' | 'page'
  onCerrar: () => void
  onGuardado: () => void
}

const TITULO = 'Editar profesor'

export function ProfesorEditar({ profesorId, mode, onCerrar, onGuardado }: ProfesorEditarProps) {
  const id = parsearProfesorId(profesorId)
  const { data: profesor, isLoading, isError, error, refetch } = useProfesor(id ?? 0)
  const mutation = useEditarProfesor(id ?? 0)
  const toast = useToast()

  const estado = { mode, onCerrar, titulo: TITULO }
  if (id === null) return <ProfesorPanelEstado {...estado} estado="no-encontrado" />
  if (isLoading) return <ProfesorPanelEstado {...estado} estado="cargando" />
  if (isError && error?.status === 404) {
    return <ProfesorPanelEstado {...estado} estado="no-encontrado" />
  }
  if (isError || !profesor) {
    return (
      <ProfesorPanelEstado
        {...estado}
        estado="error"
        error={error}
        onReintentar={() => refetch()}
      />
    )
  }

  return (
    <Panel mode={mode} onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>
            {TITULO} — {profesor.nombre} {profesor.apellido}
          </PanelTitle>
          <PanelDescription>Los campos con * son obligatorios</PanelDescription>
        </div>
      </PanelHeader>
      <ProfesorForm
        modo="editar"
        profesorId={profesor.id}
        fotoUrl={profesor.fotoUrl}
        defaultValues={detalleAValoresForm(profesor)}
        onSubmit={(cambios) => {
          // Cambios que se deshicieron a mano: no hay nada que mandar.
          if (!cambios) return onCerrar()
          mutation.mutate(cambios, {
            onSuccess: (actualizado) => {
              toast.success(
                `Se guardaron los cambios de ${actualizado.nombre} ${actualizado.apellido}`,
              )
              onGuardado()
            },
          })
        }}
        onCancelar={onCerrar}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </Panel>
  )
}
