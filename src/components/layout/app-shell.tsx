'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useSyncExternalStore } from 'react'

import { SidebarLogo } from '@/components/layout/sidebar-logo'

type ModoSidebar = 'fijo' | 'iconos'

const CLAVE_MODO = 'aula-click:sidebar-modo'
const EVENTO_MODO = 'aula-click:sidebar-modo-cambio'

// El modo se guarda en localStorage (preferencia de este navegador). Se lee con
// useSyncExternalStore: en el servidor y en la hidratación vale 'iconos' (el modo por defecto).
function leerModo(): ModoSidebar {
  try {
    return localStorage.getItem(CLAVE_MODO) === 'fijo' ? 'fijo' : 'iconos'
  } catch {
    return 'iconos'
  }
}

function guardarModo(modo: ModoSidebar) {
  try {
    localStorage.setItem(CLAVE_MODO, modo)
  } catch {
    // Sin localStorage (modo privado, bloqueado): el cambio rige hasta recargar.
  }
  window.dispatchEvent(new Event(EVENTO_MODO))
}

function suscribirModo(onChange: () => void) {
  window.addEventListener(EVENTO_MODO, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENTO_MODO, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// Esqueleto de la app autenticada: una columna oscura (logo + Sidebar del rol + menú de usuario)
// y el contenido a la derecha. El Sidebar y el menú de usuario llegan por props desde el layout
// del segmento: components/ no puede importar de features/ (ESLint).
//
// El Sidebar tiene dos modos, que la persona elige con el botón de arriba del menú de usuario
// (no reacciona al puntero):
// - 'iconos' (por defecto): colapsado a 4rem, solo íconos.
// - 'fijo': expandido a 16rem, con los nombres; el contenido ocupa el resto.
// El wrapper anima su ancho y recorta (overflow-hidden) un <aside> de ancho fijo, así los textos
// no se reacomodan durante la animación. Los hijos (SidebarLogo, SidebarNav, UserMenu) muestran
// sus textos con la variante CSS `sidebar-abierto` (globals.css), que se apoya en `data-modo`.
export function AppShell({
  sidebar,
  userMenu,
  children,
}: {
  sidebar: ReactNode
  userMenu: ReactNode
  children: ReactNode
}) {
  const modo = useSyncExternalStore(suscribirModo, leerModo, () => 'iconos' as const)
  const fijo = modo === 'fijo'
  const Icono = fijo ? PanelLeftClose : PanelLeftOpen
  const textoBoton = fijo ? 'Mostrar solo íconos' : 'Expandir el menú'

  return (
    <div className="bg-canvas fixed inset-0 flex">
      <div
        data-modo={modo}
        data-no-imprimir
        className="group/sidebar w-16 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out data-[modo=fijo]:w-64 motion-reduce:transition-none"
      >
        <aside className="bg-sidebar flex h-full w-64 flex-col">
          <SidebarLogo />
          <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4">{sidebar}</div>
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => guardarModo(fijo ? 'iconos' : 'fijo')}
              aria-label={textoBoton}
              title={textoBoton}
              className="flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icono className="size-4 shrink-0" />
              <span className="sidebar-abierto:opacity-100 flex-1 text-left whitespace-nowrap opacity-0 transition-opacity duration-300">
                {textoBoton}
              </span>
            </button>
          </div>
          <div className="border-t border-white/10 p-3">{userMenu}</div>
        </aside>
      </div>
      <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-10">{children}</main>
    </div>
  )
}
