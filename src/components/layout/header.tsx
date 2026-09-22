import Link from 'next/link'
import type { ReactNode } from 'react'

// Uno solo para todos los roles. No sabe quién está logueado: el menú de usuario llega por props.
export function Header({ userMenu }: { userMenu: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
      <Link href="/" className="text-sm font-semibold text-slate-900">
        Aula Click
      </Link>
      {userMenu}
    </header>
  )
}
