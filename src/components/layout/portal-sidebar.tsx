'use client'

import { CalendarDays, CalendarPlus, GraduationCap, Settings, Wallet } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

// Menú del portal del alumno (T-80). Cada pantalla la completa su tarea.
const links = [
  { href: '/portal/calendario', label: 'Mi calendario', icon: CalendarDays },
  { href: '/portal/turnos/nuevo', label: 'Sacar turno', icon: CalendarPlus },
  { href: '/portal/materias', label: 'Mis materias', icon: GraduationCap },
  { href: '/portal/pagos', label: 'Mis pagos', icon: Wallet },
  { href: '/portal/configuracion', label: 'Configuración', icon: Settings },
]

export function PortalSidebar() {
  return <SidebarNav label="Portal del alumno" links={links} />
}
