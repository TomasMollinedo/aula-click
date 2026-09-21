import type { ReactNode } from 'react'

import { PersonalMesaEntradasSidebar } from '@/components/layout/personal-mesa-entradas-sidebar'

// Solo layout/sidebar — sin auth acá. La autorización real vive en server/middlewares/auth.ts.
export default function PersonalMesaEntradasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <PersonalMesaEntradasSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
