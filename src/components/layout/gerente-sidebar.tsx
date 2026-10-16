'use client'

import { Banknote, BookOpen, HandCoins, LayoutDashboard, Settings, Wallet } from 'lucide-react'

import { SidebarNav } from '@/components/layout/sidebar-nav'

const links = [
  { href: '/gerente/tablero', label: 'Tablero', icon: LayoutDashboard },
  { href: '/gerente/pagos', label: 'Pagos', icon: Wallet },
  { href: '/gerente/liquidaciones', label: 'Liquidaciones', icon: HandCoins },
  { href: '/gerente/caja', label: 'Caja diaria', icon: Banknote },
  { href: '/gerente/configuracion', label: 'Configuración', icon: Settings },
  { href: '/gerente/materias', label: 'Materias', icon: BookOpen },
]

export function GerenteSidebar() {
  return <SidebarNav label="Gerente" links={links} />
}
