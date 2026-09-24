// El slot @modal de la página de detalle muestra la edición como modal encima de ella: navegando
// desde el detalle la intercepta @modal/(.)editar; entrando por URL (o al recargar), @modal/editar.
// Desde el lápiz del listado, en cambio, la intercepta el slot del listado (alumnos/@modal).
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function AlumnoLayout({ children, modal }: LayoutProps<'/mesa/alumnos/[alumnoId]'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
