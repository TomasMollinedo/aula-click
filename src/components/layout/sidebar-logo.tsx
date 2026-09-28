import { MousePointer2 } from 'lucide-react'

// Isotipo + wordmark, arriba de la columna del Sidebar (components/layout/app-shell.tsx).
// No es un link: no hay una pantalla propia de "/" a la que volver desde acá.
export function SidebarLogo() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <span className="bg-dorado flex size-8 shrink-0 items-center justify-center rounded-lg">
        <MousePointer2 className="size-4 fill-white text-white" />
      </span>
      <span className="text-base font-semibold">
        <span className="text-white">Aula</span>
        <span className="text-dorado">Click</span>
      </span>
    </div>
  )
}
