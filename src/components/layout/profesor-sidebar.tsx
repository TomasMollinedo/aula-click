'use client'

import { CalendarDays, ClipboardCheck, Users } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/profesor/agenda', label: 'Mi agenda', icon: CalendarDays },
  { href: '/profesor/asistencia', label: 'Asistencia', icon: ClipboardCheck },
  { href: '/profesor/alumnos', label: 'Mis alumnos', icon: Users },
]

export function ProfesorSidebar() {
  return <SidebarNav label="Profesor" links={links} />
}
