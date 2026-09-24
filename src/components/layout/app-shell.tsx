import type { ReactNode } from 'react'

import { SidebarLogo } from '@/components/layout/sidebar-logo'

// Esqueleto de la app autenticada: una columna oscura (logo + Sidebar del rol + menú de usuario)
// y el contenido a la derecha. El Sidebar y el menú de usuario llegan por props desde el layout
// del segmento: components/ no puede importar de features/ (ESLint).
export function AppShell({
  sidebar,
  userMenu,
  children,
}: {
  sidebar: ReactNode
  userMenu: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-canvas flex min-h-full flex-1">
      <aside className="bg-sidebar flex w-64 shrink-0 flex-col">
        <SidebarLogo />
        <div className="flex-1 overflow-y-auto px-3 pb-4">{sidebar}</div>
        <div className="border-t border-white/10 p-3">{userMenu}</div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-10">{children}</main>
    </div>
  )
}
