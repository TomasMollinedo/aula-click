import { AppShell } from '@/components/layout/app-shell'
import { PortalSidebar } from '@/components/layout/portal-sidebar'
import { SegmentoDeRol } from '@/features/auth/components/SegmentoDeRol'
import { UserMenu } from '@/features/auth/components/UserMenu'
import { AvisoMesaDeEntrada } from '@/features/centro/components/AvisoMesaDeEntrada'
import { AvisoContrasenaInicial } from '@/features/usuarios/components/AvisoContrasenaInicial'

// Portal del alumno (T-80), pensado para el celular. Los avisos van arriba de todas sus pantallas.
export default function PortalLayout({ children }: LayoutProps<'/portal'>) {
  return (
    <SegmentoDeRol rol="ALUMNO">
      <AppShell sidebar={<PortalSidebar />} userMenu={<UserMenu />}>
        <div className="space-y-6">
          <div className="space-y-3">
            <AvisoContrasenaInicial />
            <AvisoMesaDeEntrada />
          </div>
          {children}
        </div>
      </AppShell>
    </SegmentoDeRol>
  )
}
