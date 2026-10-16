'use client'

import { CalendarDays, ClipboardCheck, Users, Wallet } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/profesor/agenda', label: 'Mi agenda', icon: CalendarDays },
  { href: '/profesor/asistencia', label: 'Asistencia', icon: ClipboardCheck },
  { href: '/profesor/alumnos', label: 'Mis alumnos', icon: Users },
  { href: '/profesor/ingresos', label: 'Mis ingresos', icon: Wallet },
]

export function ProfesorSidebar() {
  return <SidebarNav label="Profesor" links={links} />
}
