import type { ReactNode } from 'react'

import { Header } from '@/components/layout/header'

// Esqueleto de la app autenticada. El Sidebar y el menú de usuario llegan por props desde el
// layout del segmento: components/ no puede importar de features/ (ESLint).
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
    <div className="flex min-h-full flex-1 flex-col">
      <Header userMenu={userMenu} />
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
