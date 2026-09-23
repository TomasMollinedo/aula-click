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
      <p className="text-luminoso/50 mb-4 px-3 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <ul className="space-y-1">
        {links.map((link) => {
          const activo = pathname.startsWith(link.href)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  'text-luminoso/80 hover:text-luminoso flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-white/5',
                  activo && 'bg-cobalto/20 text-luminoso font-medium',
                )}
              >
                <link.icon className="size-4 shrink-0" />
                <span className="flex-1">{link.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
