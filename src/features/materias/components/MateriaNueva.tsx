'use client'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { useToast } from '@/hooks/use-toast'

import { useCrearMateria } from '../hooks/use-crear-materia'
import type { MateriaDetalle } from '../materias.types'
import { MateriaForm } from './MateriaForm'

type MateriaNuevaProps = {
  mode: 'modal' | 'page'
  onCerrar: () => void
  onCreada: (materia: MateriaDetalle) => void
}

export function MateriaNueva({ mode, onCerrar, onCreada }: MateriaNuevaProps) {
  const mutation = useCrearMateria()
  const toast = useToast()

  return (
    <Panel mode={mode} onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>Nueva materia</PanelTitle>
          <PanelDescription>Los campos con * son obligatorios</PanelDescription>
        </div>
      </PanelHeader>
      <MateriaForm
        onSubmit={(datos) =>
          mutation.mutate(datos, {
            onSuccess: (materia) => {
              toast.success(`Se registró la materia ${materia.nombre}`)
              onCreada(materia)
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
