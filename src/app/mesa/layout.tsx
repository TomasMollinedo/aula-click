import { AppShell } from '@/components/layout/app-shell'
import { MesaSidebar } from '@/components/layout/mesa-sidebar'
import { SegmentoDeRol } from '@/features/auth/components/SegmentoDeRol'
import { UserMenu } from '@/features/auth/components/UserMenu'

import { DetallePagoDesdeUrl } from './_componentes/detalle-pago-desde-url'

export default function MesaLayout({ children }: LayoutProps<'/mesa'>) {
  return (
    <SegmentoDeRol rol="MESA_ENTRADAS">
      <AppShell sidebar={<MesaSidebar />} userMenu={<UserMenu />}>
        {children}
        {/* El detalle de un pago (`?pago=`), para todas las pantallas de mesa de entradas. */}
        <DetallePagoDesdeUrl />
      </AppShell>
    </SegmentoDeRol>
  )
}
