// El slot @modal muestra alta, detalle y edición siempre como modal encima del listado: navegando
// desde él lo interceptan las rutas (.)…; entrando por URL (o al recargar), las de @modal/nuevo y
// @modal/[alumnoId], con el listado de fondo (children). docs/arquitectura-frontend.md → Modales con URL propia.
export default function AlumnosLayout({ children, modal }: LayoutProps<'/mesa/alumnos'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
