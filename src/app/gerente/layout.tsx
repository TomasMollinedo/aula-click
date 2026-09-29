import { AppShell } from '@/components/layout/app-shell'
import { GerenteSidebar } from '@/components/layout/gerente-sidebar'
import { SegmentoDeRol } from '@/features/auth/components/SegmentoDeRol'
import { UserMenu } from '@/features/auth/components/UserMenu'

export default function GerenteLayout({ children }: LayoutProps<'/gerente'>) {
  return (
    <SegmentoDeRol rol="GERENTE">
      <AppShell sidebar={<GerenteSidebar />} userMenu={<UserMenu />}>
        {children}
      </AppShell>
    </SegmentoDeRol>
  )
}
