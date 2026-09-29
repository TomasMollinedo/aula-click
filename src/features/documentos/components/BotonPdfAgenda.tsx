'use client'

import type { FiltrosAgenda } from '@/types/agenda'

export type BotonPdfAgendaProps = {
  /** Día de la agenda (`YYYY-MM-DD`). */
  fecha: string
  filtros: FiltrosAgenda
}

/** PLACEHOLDER de T-35, lo completa T-60: "Generar PDF" de la agenda diaria, en su encabezado. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function BotonPdfAgenda(_props: BotonPdfAgendaProps) {
  return null
}
