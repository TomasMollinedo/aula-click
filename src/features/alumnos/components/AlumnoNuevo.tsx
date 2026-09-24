'use client'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'

import type { AlumnoDetalle } from '../alumnos.types'
import { useCrearAlumno } from '../hooks/use-crear-alumno'
import { AlumnoForm } from './AlumnoForm'

type AlumnoNuevoProps = {
  mode: 'modal' | 'page'
  onCerrar: () => void
  onCreado: (alumno: AlumnoDetalle) => void
}

export function AlumnoNuevo({ mode, onCerrar, onCreado }: AlumnoNuevoProps) {
  const mutation = useCrearAlumno()

  return (
    <Panel mode={mode} onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>Nuevo alumno</PanelTitle>
          <PanelDescription>Los campos con * son obligatorios</PanelDescription>
        </div>
      </PanelHeader>
      <AlumnoForm
        modo="crear"
        onSubmit={(datos) => mutation.mutate(datos, { onSuccess: onCreado })}
        onCancelar={onCerrar}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </Panel>
  )
}
