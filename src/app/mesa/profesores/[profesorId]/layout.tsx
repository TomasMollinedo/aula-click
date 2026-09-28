// El slot @modal de la página de detalle muestra la edición como modal encima de ella: navegando
// desde el detalle la intercepta @modal/(.)editar; entrando por URL (o al recargar), @modal/editar.
// Desde el lápiz del listado, en cambio, es ?editar=<id> en ProfesoresListado (sin intercepción).
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function ProfesorLayout({
  children,
  modal,
}: LayoutProps<'/mesa/profesores/[profesorId]'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
