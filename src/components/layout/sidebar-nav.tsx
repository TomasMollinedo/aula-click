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
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'text-luminoso/70 hover:text-luminoso flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/5',
                  activo && 'bg-cobalto/20 text-luminoso hover:bg-cobalto/20 font-medium',
                )}
              >
                <link.icon className="size-4 shrink-0" />
                <span className="flex-1">
                  {link.label}
                  {activo && (
                    <span
                      aria-hidden
                      className="bg-dorado ml-2 inline-block size-1.5 rounded-full align-middle"
                    />
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
