'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/utils/cn'

export type SidebarLink = {
  href: string
  label: string
  icon: LucideIcon
}

// Compartido por components/layout/{mesa,profesor}-sidebar.tsx: mismo look y misma lógica de
// estado activo, un array de links distinto por rol.
export function SidebarNav({ label, links }: { label: string; links: SidebarLink[] }) {
  const pathname = usePathname()

  return (
    <nav>
      <p className="mb-4 px-3 text-xs font-medium tracking-wide text-white/60 uppercase">{label}</p>
      <ul className="space-y-1">
        {links.map((link) => {
          const activo = pathname.startsWith(link.href)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5 hover:text-white',
                  activo &&
                    'border-dorado bg-dorado/10 hover:bg-dorado/10 font-semibold text-white',
                )}
              >
                <link.icon className={cn('size-4 shrink-0', activo && 'text-dorado')} />
                <span className="flex-1">{link.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
