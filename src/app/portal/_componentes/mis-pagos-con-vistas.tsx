'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MisPendientes } from '@/features/cuentas/components/MisPendientes'
import { MisPagosRealizados } from '@/features/pagos/components/MisPagosRealizados'
import { useVistaEnUrl } from '@/hooks/use-vista-en-url'

const VISTAS = ['pendientes', 'realizados'] as const
type Vista = (typeof VISTAS)[number]

// Las dos subpestañas de "Mis pagos" del portal (`?vista=pendientes|realizados`; sin `vista`, lo
// pendiente), como las de Pagos de la mesa (`mesa/_componentes/pagos-con-vistas.tsx`). Se compone
// acá porque cada una es de otra feature (`cuentas` y `pagos`). Solo se monta la subpestaña activa,
// así la otra no pide datos.
export function MisPagosConVistas() {
  const { vista, cambiar } = useVistaEnUrl<Vista>({
    valores: VISTAS,
    porDefecto: 'pendientes',
  })

  return (
    <Tabs value={vista} onValueChange={(valor) => cambiar(valor as Vista)} className="space-y-6">
      <TabsList>
        <TabsTrigger value="pendientes" className="px-4">
          Pendiente de pago
        </TabsTrigger>
        <TabsTrigger value="realizados" className="px-4">
          Pagos realizados
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pendientes">
        <MisPendientes />
      </TabsContent>
      <TabsContent value="realizados">
        <MisPagosRealizados />
      </TabsContent>
    </Tabs>
  )
}
