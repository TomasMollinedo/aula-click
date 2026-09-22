import { AppShell } from '@/components/layout/app-shell'
import { ProfesorSidebar } from '@/components/layout/profesor-sidebar'
import { SegmentoDeRol } from '@/features/auth/components/SegmentoDeRol'
import { UserMenu } from '@/features/auth/components/UserMenu'

export default function ProfesorLayout({ children }: LayoutProps<'/profesor'>) {
  return (
    <SegmentoDeRol rol="PROFESOR">
      <AppShell sidebar={<ProfesorSidebar />} userMenu={<UserMenu />}>
        {children}
      </AppShell>
    </SegmentoDeRol>
  )
}
