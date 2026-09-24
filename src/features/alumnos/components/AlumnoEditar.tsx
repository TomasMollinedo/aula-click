'use client'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'

import { detalleAValoresForm, parsearAlumnoId } from '../alumnos.schema'
import { useAlumno } from '../hooks/use-alumno'
import { useEditarAlumno } from '../hooks/use-editar-alumno'
import { AlumnoForm } from './AlumnoForm'
import { AlumnoPanelEstado } from './AlumnoPanelEstado'

type AlumnoEditarProps = {
  /** `alumnoId` tal como llega en la URL. */
  alumnoId: string
  mode: 'modal' | 'page'
  onCerrar: () => void
  onGuardado: () => void
}

const TITULO = 'Editar alumno'

export function AlumnoEditar({ alumnoId, mode, onCerrar, onGuardado }: AlumnoEditarProps) {
  const id = parsearAlumnoId(alumnoId)
  const { data: alumno, isLoading, isError, error, refetch } = useAlumno(id ?? 0)
  const mutation = useEditarAlumno(id ?? 0)

  const estado = { mode, onCerrar, titulo: TITULO }
  if (id === null) return <AlumnoPanelEstado {...estado} estado="no-encontrado" />
  if (isLoading) return <AlumnoPanelEstado {...estado} estado="cargando" />
  if (isError && error?.status === 404) {
    return <AlumnoPanelEstado {...estado} estado="no-encontrado" />
  }
  if (isError || !alumno) {
    return (
      <AlumnoPanelEstado {...estado} estado="error" error={error} onReintentar={() => refetch()} />
    )
  }

  return (
    <Panel mode={mode} onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>
            {TITULO} — {alumno.nombre} {alumno.apellido}
          </PanelTitle>
          <PanelDescription>Los campos con * son obligatorios</PanelDescription>
        </div>
      </PanelHeader>
      <AlumnoForm
        modo="editar"
        defaultValues={detalleAValoresForm(alumno)}
        onSubmit={(cambios) => {
          // Cambios que se deshicieron a mano: no hay nada que mandar.
          if (!cambios) return onCerrar()
          mutation.mutate(cambios, { onSuccess: onGuardado })
        }}
        onCancelar={onCerrar}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </Panel>
  )
}
