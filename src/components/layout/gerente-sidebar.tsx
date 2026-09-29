'use client'

import { BookOpen, LayoutDashboard } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/gerente/tablero', label: 'Tablero', icon: LayoutDashboard },
  { href: '/gerente/materias', label: 'Materias', icon: BookOpen },
]

export function GerenteSidebar() {
  return <SidebarNav label="Gerente" links={links} />
}
