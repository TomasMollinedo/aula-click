'use client'

import { Suspense, use } from 'react'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { AgendaProfesorListado } from '@/features/agendas/components/AgendaProfesorListado'
import { ProfesorDetalle } from '@/features/profesores/components/ProfesorDetalle'

// Edición entrando por URL: el detalle de fondo; el modal lo pone [profesorId]/@modal/editar.
export default function EditarProfesorPage({
  params,
}: PageProps<'/mesa/profesores/[profesorId]/editar'>) {
  const { profesorId } = use(params)
  // Suspense: el detalle lee el tab de la URL con useSearchParams.
  return (
    <Suspense>
      <ProfesorDetalle
        profesorId={profesorId}
        rutaBase="/mesa/profesores"
        renderAgenda={(profesor) => (
          <AgendaProfesorListado
            profesorId={profesor.id}
            renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
          />
        )}
      />
    </Suspense>
  )
}
