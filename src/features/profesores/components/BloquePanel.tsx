'use client'

import { Panel, PanelDescription, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { useToast } from '@/hooks/use-toast'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { rangoHoras } from '../horario'
import {
  BLOQUE_FORM_VACIO,
  bloqueAValoresForm,
  valoresFormACrearBloque,
  valoresFormAEditarBloque,
} from '../profesores.schema'
import { useCrearBloque } from '../hooks/use-crear-bloque'
import { useEditarBloque } from '../hooks/use-editar-bloque'
import { useHorarioProfesor } from '../hooks/use-horario-profesor'
import { BloqueForm } from './BloqueForm'
import { ProfesorPanelEstado } from './ProfesorPanelEstado'

type BloquePanelProps = {
  profesorId: number
  /** `'nuevo'` para el alta de un rango de horas, o el id de la hora que se edita. */
  bloque: 'nuevo' | number
  /** Cerrar y guardar: quien lo monta decide cómo navegar (docs/arquitectura-frontend.md). */
  onCerrar: () => void
}

const TEXTOS_ESTADO = {
  descripcion: 'Horario de atención',
  cargando: 'Cargando el horario…',
  noEncontrado: 'Hora no encontrada',
  volver: 'Volver al horario',
  sinPermiso: 'No tenés permiso para ver el horario',
}

// Alta y edición de un bloque del horario, como modal sobre la sección "Horario" de la ficha.
export function BloquePanel({ profesorId, bloque, onCerrar }: BloquePanelProps) {
  if (bloque === 'nuevo') return <BloqueNuevo profesorId={profesorId} onCerrar={onCerrar} />
  return <BloqueEditar profesorId={profesorId} bloqueId={bloque} onCerrar={onCerrar} />
}

function BloqueNuevo({ profesorId, onCerrar }: { profesorId: number; onCerrar: () => void }) {
  const mutation = useCrearBloque(profesorId)
  const toast = useToast()

  return (
    <Panel mode="modal" onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>Nuevo bloque</PanelTitle>
          <PanelDescription>
            Un rango de varias horas se guarda como una hora por fila. Todos los campos son
            obligatorios.
          </PanelDescription>
        </div>
      </PanelHeader>
      <BloqueForm
        modo="crear"
        defaultValues={BLOQUE_FORM_VACIO}
        onSubmit={(valores) =>
          mutation.mutate(valoresFormACrearBloque(valores), {
            onSuccess: ({ cantidad }) => {
              toast.success(
                `Se cargó el bloque del ${nombreDiaSemana(Number(valores.diaSemana)).toLowerCase()} de ${rangoHoras(valores.horaInicio, valores.horaFin)} (${cantidad} ${cantidad === 1 ? 'hora' : 'horas'})`,
              )
              onCerrar()
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

function BloqueEditar({
  profesorId,
  bloqueId,
  onCerrar,
}: {
  profesorId: number
  bloqueId: number
  onCerrar: () => void
}) {
  const horario = useHorarioProfesor(profesorId)
  const mutation = useEditarBloque(profesorId)
  const toast = useToast()

  const titulo = 'Editar hora'
  const estado = { mode: 'modal' as const, onCerrar, titulo, textos: TEXTOS_ESTADO }
  if (horario.isLoading) return <ProfesorPanelEstado {...estado} estado="cargando" />
  if (horario.isError) {
    return (
      <ProfesorPanelEstado
        {...estado}
        estado="error"
        error={horario.error}
        onReintentar={() => horario.refetch()}
      />
    )
  }

  const actual = horario.data?.find((fila) => fila.id === bloqueId)
  if (!actual) return <ProfesorPanelEstado {...estado} estado="no-encontrado" />

  return (
    <Panel mode="modal" onClose={onCerrar} dismissOnInteractOutside={false}>
      <PanelHeader>
        <div>
          <PanelTitle>
            {titulo} — {nombreDiaSemana(actual.diaSemana)} de{' '}
            {rangoHoras(actual.horaInicio, actual.horaFin)}
          </PanelTitle>
          <PanelDescription>
            Se edita solo esta hora. La hora de fin es siempre una hora después del inicio.
          </PanelDescription>
        </div>
      </PanelHeader>
      <BloqueForm
        modo="editar"
        bloqueId={actual.id}
        defaultValues={bloqueAValoresForm(actual)}
        onSubmit={(valores) => {
          const cambios = valoresFormAEditarBloque(valores, actual)
          // Cambios que se deshicieron a mano: no hay nada que mandar.
          if (!cambios) return onCerrar()
          mutation.mutate(
            { bloqueId: actual.id, cambios },
            {
              onSuccess: (editado) => {
                toast.success(
                  `Se guardó la hora: ${nombreDiaSemana(editado.diaSemana).toLowerCase()} de ${rangoHoras(editado.horaInicio, editado.horaFin)} en ${editado.aula.nombre}`,
                )
                onCerrar()
              },
            },
          )
        }}
        onCancelar={onCerrar}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </Panel>
  )
}
