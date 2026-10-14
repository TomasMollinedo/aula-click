'use client'

import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useVistaEnUrl } from '@/hooks/use-vista-en-url'

const VISTAS = ['por-cobrar', 'realizados'] as const
type Vista = (typeof VISTAS)[number]

// En la ficha, `tab=pagos` es de `AlumnoDetalle` y tiene que sobrevivir al cambio de subpestaña; en
// `/mesa/pagos` no hay nada que conservar.
const EN_FICHA = ['tab'] as const
const EN_PAGOS: readonly string[] = []

type PagosConVistasProps = {
  /** `true` en la pestaña "Pagos" de la ficha del alumno (`?tab=pagos&vista=`). */
  enFicha?: boolean
  /** "Por cobrar": `PagosDelAlumno` (ficha) o `PagosGlobal` (`/mesa/pagos`), de `cuentas`. */
  porCobrar: ReactNode
  /** "Pagos realizados": `PagosRealizados`, de `pagos`. */
  realizados: ReactNode
}

// Las dos subpestañas de "Pagos" de mesa de entradas (`?vista=por-cobrar|realizados`; sin `vista`,
// "Por cobrar"). Se compone acá porque cada una es de otra feature (`cuentas` y `pagos`). Al
// cambiar de subpestaña los filtros de la otra se van (`useVistaEnUrl` arma la URL de cero). Solo
// se monta la subpestaña activa, así la otra no pide datos.
export function PagosConVistas({ enFicha = false, porCobrar, realizados }: PagosConVistasProps) {
  const { vista, cambiar } = useVistaEnUrl<Vista>({
    valores: VISTAS,
    porDefecto: 'por-cobrar',
    conservar: enFicha ? EN_FICHA : EN_PAGOS,
  })

  return (
    <Tabs value={vista} onValueChange={(valor) => cambiar(valor as Vista)} className="space-y-6">
      <TabsList>
        <TabsTrigger value="por-cobrar" className="px-4">
          Por cobrar
        </TabsTrigger>
        <TabsTrigger value="realizados" className="px-4">
          Pagos realizados
        </TabsTrigger>
      </TabsList>
      <TabsContent value="por-cobrar">{porCobrar}</TabsContent>
      <TabsContent value="realizados">{realizados}</TabsContent>
    </Tabs>
  )
}
