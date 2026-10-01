'use client'

import { createContext, type ReactNode, useContext } from 'react'

// El detalle de un turno se abre desde la URL (`?detalle=&fecha=`, `useDetalleEnUrl`), y cerrarlo
// depende de si se abrió con un link en esta pestaña (`router.back()`) o se entró por URL. Para que
// ese dato lo compartan quien abre y quien cierra, `AgendaConModo` es el único que llama al hook y
// les pasa lo que necesitan a la lista y al calendario por este contexto.

type DetalleAgenda = {
  /** URL de la pantalla actual con el detalle de esa ocurrencia (`turnoId` + `fecha`). */
  hrefDetalle: (turnoId: number, fecha: string) => string
  /** Se llama en el clic que abre el detalle con un link, antes de navegar. */
  marcarAbiertoConLink: () => void
}

const DetalleAgendaContext = createContext<DetalleAgenda | null>(null)

export function DetalleAgendaProvider({
  value,
  children,
}: {
  value: DetalleAgenda
  children: ReactNode
}) {
  return <DetalleAgendaContext.Provider value={value}>{children}</DetalleAgendaContext.Provider>
}

/** Cómo abrir el detalle de una ocurrencia desde una agenda. Va dentro de `AgendaConModo`. */
export function useDetalleAgenda(): DetalleAgenda {
  const detalle = useContext(DetalleAgendaContext)
  if (!detalle) throw new Error('useDetalleAgenda va dentro de AgendaConModo')
  return detalle
}
