'use client'

import { BookOpen, CalendarClock, CalendarPlus, User, Users } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/mesa/alumnos', label: 'Alumnos', icon: User },
  { href: '/mesa/profesores', label: 'Profesores', icon: Users },
  { href: '/mesa/materias', label: 'Materias', icon: BookOpen },
  { href: '/mesa/turnos', label: 'Registrar turno', icon: CalendarPlus },
  { href: '/mesa/agenda', label: 'Agenda diaria', icon: CalendarClock },
]

export function MesaSidebar() {
  return <SidebarNav label="Centro de atención" links={links} />
}
