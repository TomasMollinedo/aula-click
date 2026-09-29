'use client'

import { Card } from '@/components/ui/card'
import type { FiltrosAgenda } from '@/types/agenda'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

import type { OrigenAgenda } from '../agendas.types'

export type CalendarioSemanalProps = {
  origen: OrigenAgenda
  /** Los filtros de la URL (`useFiltrosAgenda`): valen igual que en la lista. */
  filtros: FiltrosAgenda
  /** Compone `app/` el detalle de un turno; lo abre `?detalle=&fecha=` (`useDetalleEnUrl`). */
  renderDetalle: RenderDetalleOcurrencia
}

/**
 * PLACEHOLDER de T-35, lo completa T-59: el calendario semanal de una agenda (HU-19). Mientras
 * tanto la agenda muestra este aviso al elegir "Calendario".
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function CalendarioSemanal(_props: CalendarioSemanalProps) {
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        El calendario semanal estará disponible próximamente.
      </p>
    </Card>
  )
}
