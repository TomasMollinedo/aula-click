'use client'

import { BookOpen, LayoutDashboard, Wallet } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/gerente/tablero', label: 'Tablero', icon: LayoutDashboard },
  { href: '/gerente/pagos', label: 'Pagos', icon: Wallet },
  { href: '/gerente/materias', label: 'Materias', icon: BookOpen },
]

export function GerenteSidebar() {
  return <SidebarNav label="Gerente" links={links} />
}
