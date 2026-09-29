'use client'

import { Suspense, use } from 'react'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { AgendaProfesorListado } from '@/features/agendas/components/AgendaProfesorListado'
import { ProfesorDetalle } from '@/features/profesores/components/ProfesorDetalle'

// El detalle es una página (no un modal): "Editar" abre la edición como modal encima de ella.
export default function DetalleProfesorPage({
  params,
}: PageProps<'/mesa/profesores/[profesorId]'>) {
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
