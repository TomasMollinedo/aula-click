import type { ReactNode } from 'react'

import { MesaSidebar } from '@/components/layout/mesa-sidebar'

// Solo layout/sidebar — sin auth acá. La autorización real vive en server/middlewares/auth.ts.
export default function MesaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <MesaSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
