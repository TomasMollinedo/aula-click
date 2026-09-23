'use client'

import { CalendarDays, Users } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/profesor/agenda', label: 'Mi agenda', icon: CalendarDays },
  { href: '/profesor/alumnos', label: 'Mis alumnos', icon: Users },
]

export function ProfesorSidebar() {
  return <SidebarNav label="Profesor" links={links} />
}
