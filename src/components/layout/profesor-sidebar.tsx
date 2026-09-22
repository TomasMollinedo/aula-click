import Link from 'next/link'

const links = [
  { href: '/profesor/agenda', label: 'Mi agenda' },
  { href: '/profesor/alumnos', label: 'Mis alumnos' },
]

export function ProfesorSidebar() {
  return (
    <nav className="w-56 shrink-0 border-r border-slate-200 p-4">
      <p className="mb-4 text-xs font-medium tracking-wide text-slate-400 uppercase">Profesor</p>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
