import Link from 'next/link'

const links = [
  { href: '/alumnos', label: 'Alumnos' },
  { href: '/profesores', label: 'Profesores' },
  { href: '/materias', label: 'Materias' },
  { href: '/turnos', label: 'Turnos' },
  { href: '/calendario', label: 'Calendario' },
]

// El Sidebar es por rol (uno por cada route group, ej. (profesor)/ tendría
// profesor-sidebar.tsx). El Header, si hace falta uno (logo, menú de usuario), es el mismo
// para todos los roles — va en components/layout/header.tsx y se monta una sola vez en el
// layout raíz (src/app/layout.tsx), no acá. Ver arquitectura-frontend.md.
export function PersonalMesaEntradasSidebar() {
  return (
    <nav className="w-56 shrink-0 border-r border-slate-200 p-4">
      <p className="mb-4 text-xs font-medium tracking-wide text-slate-400 uppercase">
        Personal de mesa de entradas
      </p>
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
