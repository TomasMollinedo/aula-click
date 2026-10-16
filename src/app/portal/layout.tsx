import { AppShell } from '@/components/layout/app-shell'
import { PortalSidebar } from '@/components/layout/portal-sidebar'
import { SegmentoDeRol } from '@/features/auth/components/SegmentoDeRol'
import { UserMenu } from '@/features/auth/components/UserMenu'
import { AvisoContrasenaInicial } from '@/features/usuarios/components/AvisoContrasenaInicial'

// Portal del alumno (T-80), pensado para el celular. El aviso de la contraseña inicial va arriba de
// todas sus pantallas; el de la mesa de entrada, sólo en "Sacar turno".
export default function PortalLayout({ children }: LayoutProps<'/portal'>) {
  return (
    <SegmentoDeRol rol="ALUMNO">
      <AppShell sidebar={<PortalSidebar />} userMenu={<UserMenu />}>
        <div className="space-y-6">
          <AvisoContrasenaInicial hrefConfiguracion="/portal/configuracion" />
          {children}
        </div>
      </AppShell>
    </SegmentoDeRol>
  )
}
