'use client'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { useToast } from '@/hooks/use-toast'

import type { AlumnoDetalle } from '../alumnos.types'
import { useCrearAlumno } from '../hooks/use-crear-alumno'
import { useSubirFotoAlumno } from '../hooks/use-subir-foto-alumno'
import { AlumnoForm } from './AlumnoForm'

type AlumnoNuevoProps = {
  mode: 'modal' | 'page'
  onCerrar: () => void
  onCreado: (alumno: AlumnoDetalle) => void
}

export function AlumnoNuevo({ mode, onCerrar, onCreado }: AlumnoNuevoProps) {
  const mutation = useCrearAlumno()
  const subirFoto = useSubirFotoAlumno()
  const toast = useToast()

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
        onSubmit={(datos, foto) =>
          mutation.mutate(datos, {
            onSuccess: (alumno) => {
              toast.success(`Se registró a ${alumno.nombre} ${alumno.apellido}`)
              // La foto se sube recién después del alta: hasta entonces el alumno no tiene id.
              if (!foto) {
                onCreado(alumno)
                return
              }
              subirFoto.mutate(
                { id: alumno.id, foto },
                {
                  onSuccess: (actualizado) => onCreado(actualizado),
                  // El alumno ya existe: no se reintenta el alta. La foto se agrega desde "Editar".
                  onError: (error) => {
                    toast.error(
                      `El alumno se creó, pero la foto no se pudo subir: ${error.message}`,
                    )
                    onCreado(alumno)
                  },
                },
              )
            },
          })
        }
        onCancelar={onCerrar}
        isPending={mutation.isPending || subirFoto.isPending}
        error={mutation.error}
      />
    </Panel>
  )
}
