// El slot @modal muestra alta, detalle y edición como modal encima del listado cuando se llega
// navegando desde él; entrando por URL (o al recargar) se ven las páginas de nuevo/ y [alumnoId]/.
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function AlumnosLayout({ children, modal }: LayoutProps<'/mesa/alumnos'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
