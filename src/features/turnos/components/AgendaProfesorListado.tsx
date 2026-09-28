'use client'

import type { ApiError } from '@/utils/fetch-json'

import { useAgendaProfesor } from '../hooks/use-agenda-profesor'
import { useRangoAgendaEnUrl } from '../hooks/use-rango-agenda-en-url'
import { AgendaPorRango } from './AgendaPorRango'

function mensajeError(error: ApiError | null): string {
  if (error?.status === 403) return 'No tenés permiso para ver esta agenda'
  if (error?.status === 404) return 'Profesor no encontrado'
  return error?.message ?? 'Ocurrió un error inesperado'
}

const TEXTOS_VACIO = {
  dia: { title: 'Sin turnos este día', description: 'Elegí otro día para ver su agenda.' },
  semana: { title: 'Sin turnos esta semana', description: 'Elegí otra semana para ver su agenda.' },
}

/**
 * Agenda de un profesor en su ficha (HU-02), de sólo lectura y también para un profesor inactivo:
 * la misma vista que "Mi agenda", con `GET /turnos/agenda-profesor` y la semana como vista por
 * defecto. La vista y la fecha van en la URL junto con `?tab=agenda` (`useRangoAgendaEnUrl`). La
 * compone `app/` en el tab "Agenda" de `ProfesorDetalle` (prop `renderAgenda`), porque
 * `features/profesores` no puede importar componentes de `features/turnos`.
 */
export function AgendaProfesorListado({ profesorId }: { profesorId: number }) {
  const { vista, fecha, rango, hoy, cambiar } = useRangoAgendaEnUrl({ vistaPorDefecto: 'semana' })
  const query = useAgendaProfesor({ profesorId, ...rango })

  return (
    <AgendaPorRango
      vista={vista}
      fecha={fecha}
      hoy={hoy}
      onCambiar={cambiar}
      query={query}
      mensajeError={mensajeError}
      textosVacio={TEXTOS_VACIO}
    />
  )
}
