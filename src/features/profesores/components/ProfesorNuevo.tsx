'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { useToast } from '@/hooks/use-toast'
import type { ApiError } from '@/utils/fetch-json'

import { subirFotoProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'
import { useCrearProfesor } from '../hooks/use-crear-profesor'
import type { ProfesorDetalle } from '../profesores.types'
import { ProfesorForm } from './ProfesorForm'

type ProfesorNuevoProps = {
  mode: 'modal' | 'page'
  onCerrar: () => void
  onCreado: (profesor: ProfesorDetalle) => void
}

export function ProfesorNuevo({ mode, onCerrar, onCreado }: ProfesorNuevoProps) {
  const mutation = useCrearProfesor()
  const queryClient = useQueryClient()
  const toast = useToast()

  // La foto se sube recién después del alta: hasta entonces el profesor no tiene id. Por eso esta
  // mutación toma el id como variable en lugar de fijarlo al crear el hook (a diferencia de
  // use-subir-foto-profesor, pensado para la edición, donde el id ya se conoce de antemano).
  const subirFoto = useMutation<ProfesorDetalle, ApiError, { id: number; foto: File }>({
    mutationFn: ({ id, foto }) => subirFotoProfesor(id, foto),
    onSuccess: (data) => {
      queryClient.setQueryData(profesoresKeys.detail(data.id), data)
      void queryClient.invalidateQueries({ queryKey: profesoresKeys.lists() })
    },
  })

  return (
    <Panel mode={mode} onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>Nuevo profesor</PanelTitle>
          <PanelDescription>Los campos con * son obligatorios</PanelDescription>
        </div>
      </PanelHeader>
      <ProfesorForm
        modo="crear"
        onSubmit={(datos, foto) =>
          mutation.mutate(datos, {
            onSuccess: (profesor) => {
              toast.success(`Se registró a ${profesor.nombre} ${profesor.apellido}`)
              if (!foto) {
                onCreado(profesor)
                return
              }
              subirFoto.mutate(
                { id: profesor.id, foto },
                {
                  onSuccess: (actualizado) => onCreado(actualizado),
                  onError: (error) => {
                    toast.error(
                      `El profesor se creó, pero la foto no se pudo subir: ${error.message}`,
                    )
                    onCreado(profesor)
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
