'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { type MouseEvent, type ReactNode, useState, useSyncExternalStore } from 'react'

import { SidebarLogo } from '@/components/layout/sidebar-logo'

type ModoSidebar = 'fijo' | 'iconos'

const CLAVE_MODO = 'aula-click:sidebar-modo'
const EVENTO_MODO = 'aula-click:sidebar-modo-cambio'

// Por debajo de `md` (768px) la app usa la barra superior y el menú como panel.
const CONSULTA_CELULAR = '(max-width: 767.98px)'

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

function suscribirCelular(onChange: () => void) {
  const consulta = window.matchMedia(CONSULTA_CELULAR)
  consulta.addEventListener('change', onChange)
  return () => consulta.removeEventListener('change', onChange)
}

const esPantallaChica = () => window.matchMedia(CONSULTA_CELULAR).matches

const CLASE_BOTON_ICONO =
  'flex size-10 items-center justify-center rounded-lg text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-dorado'

/**
 * Lo que comparten la columna de escritorio y el panel del celular, en ese orden: el logo, el
 * Sidebar del rol (con scroll propio si no entra) y el menú de usuario, abajo y separado por un
 * borde. Cada vista suma lo suyo: `alLadoDelLogo` (la ✕ del panel) y `antesDelUsuario` (el botón de
 * modo de escritorio). Va dentro de un contenedor `flex-col` con `data-modo`.
 */
function ContenidoColumna({
  sidebar,
  userMenu,
  alLadoDelLogo,
  antesDelUsuario,
}: {
  sidebar: ReactNode
  userMenu: ReactNode
  alLadoDelLogo?: ReactNode
  antesDelUsuario?: ReactNode
}) {
  return (
    <>
      {alLadoDelLogo ? (
        <div className="flex items-center justify-between pr-2">
          <SidebarLogo />
          {alLadoDelLogo}
        </div>
      ) : (
        <SidebarLogo />
      )}
      <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4">{sidebar}</div>
      {antesDelUsuario}
      <div className="border-t border-white/10 p-3">{userMenu}</div>
    </>
  )
}

// Esqueleto de la app autenticada, para todos los roles. El Sidebar y el menú de usuario llegan por
// props desde el layout del segmento: components/ no puede importar de features/ (ESLint).
//
// Escritorio (`md` en adelante): una columna oscura (logo + Sidebar del rol + menú de usuario) y el
// contenido a la derecha. El Sidebar tiene dos modos, que la persona elige con el botón de arriba
// del menú de usuario (no reacciona al puntero):
// - 'iconos' (por defecto): colapsado a 4rem, solo íconos.
// - 'fijo': expandido a 16rem, con los nombres; el contenido ocupa el resto.
// El wrapper anima su ancho y recorta (overflow-hidden) un <aside> de ancho fijo, así los textos
// no se reacomodan durante la animación. Los hijos (SidebarLogo, SidebarNav, UserMenu) muestran
// sus textos con la variante CSS `sidebar-abierto` (globals.css), que se apoya en `data-modo`.
//
// Celular (por debajo de `md`, T-80): una barra superior con el logo y un botón que abre el mismo
// Sidebar y el menú de usuario como panel lateral (Dialog de Radix: foco adentro, cierre con
// Escape o tocando afuera), siempre con los nombres (`data-modo='fijo'`). El contenido ocupa todo
// el ancho. El panel se cierra al navegar y si la pantalla deja de ser chica.
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

  const pathname = usePathname()
  const pantallaChica = useSyncExternalStore(suscribirCelular, esPantallaChica, () => false)
  // El panel queda abierto para la ruta en la que se abrió: al navegar se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const menuAbierto = pantallaChica && abiertoEn === pathname

  // Tocar un enlace del menú cierra el panel, también si lleva a la página en la que ya está.
  function cerrarAlNavegar(e: MouseEvent<HTMLElement>) {
    if (e.target instanceof Element && e.target.closest('a')) setAbiertoEn(null)
  }

  return (
    <div className="bg-canvas fixed inset-0 flex flex-col md:flex-row">
      {/* Celular: barra superior y menú como panel */}
      <header className="bg-sidebar flex h-14 shrink-0 items-center justify-between pr-2 md:hidden">
        <div data-modo="fijo" className="group/sidebar">
          <SidebarLogo />
        </div>
        <DialogPrimitive.Root
          open={menuAbierto}
          onOpenChange={(abierto) => setAbiertoEn(abierto ? pathname : null)}
        >
          <DialogPrimitive.Trigger aria-label="Abrir el menú" className={CLASE_BOTON_ICONO}>
            <Menu className="size-5" />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="bg-tinta/50 fixed inset-0 z-50" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              onClickCapture={cerrarAlNavegar}
              className="bg-sidebar fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col shadow-xl outline-none"
            >
              <DialogPrimitive.Title className="sr-only">Menú</DialogPrimitive.Title>
              <div data-modo="fijo" className="group/sidebar flex min-h-0 flex-1 flex-col">
                <ContenidoColumna
                  sidebar={sidebar}
                  userMenu={userMenu}
                  alLadoDelLogo={
                    <DialogPrimitive.Close
                      aria-label="Cerrar el menú"
                      className={CLASE_BOTON_ICONO}
                    >
                      <X className="size-5" />
                    </DialogPrimitive.Close>
                  }
                />
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </header>

      {/* Escritorio: columna del Sidebar (modos iconos y fijo) */}
      <div
        data-modo={modo}
        className="group/sidebar hidden w-16 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out data-[modo=fijo]:w-64 motion-reduce:transition-none md:block"
      >
        <aside className="bg-sidebar flex h-full w-64 flex-col">
          <ContenidoColumna
            sidebar={sidebar}
            userMenu={userMenu}
            antesDelUsuario={
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
            }
          />
        </aside>
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-10">{children}</main>
    </div>
  )
}
