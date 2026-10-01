import type { ReactNode, Ref } from 'react'
import { Info } from 'lucide-react'

type SeccionOcurrenciasProps = {
  /** `id` del título, para el `aria-labelledby` de la sección. */
  id: string
  titulo: string
  /**
   * Si esta sección es el "refugio" del foco al cerrar el diálogo de cobro (`useDialogoDePago`): la
   * primera que se ve. El título lleva siempre `tabIndex={-1}`.
   */
  tituloRef?: Ref<HTMLHeadingElement>
  /** Un aviso bajo el título: el tope de cobro de los próximos (`avisoDelTope`). */
  aviso?: string | null
  className?: string
  children: ReactNode
}

/**
 * Una sección de la cuenta ("Turnos adeudados", "Próximos turnos") con su título. Una sección que
 * no aplica al período no se renderiza: lo decide quien la usa, con lo que dice la API.
 */
export function SeccionOcurrencias({
  id,
  titulo,
  tituloRef,
  aviso,
  className,
  children,
}: SeccionOcurrenciasProps) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2
        id={id}
        ref={tituloRef}
        tabIndex={-1}
        className="px-6 pt-6 pb-3 text-base font-semibold outline-none"
      >
        {titulo}
      </h2>
      {aviso && (
        <p
          role="status"
          className="bg-canvas text-foreground mx-6 mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Info className="text-cobalto mt-0.5 size-4 shrink-0" aria-hidden />
          {aviso}
        </p>
      )}
      {children}
    </section>
  )
}

/** El vacío de una sección que aplica y no tiene filas (`textoSinFilas`). */
export function SinFilas({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground px-6 pb-6 text-sm">{children}</p>
}
