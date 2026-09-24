// El slot @modal de la página de detalle muestra la edición como modal encima de ella: navegando
// desde el detalle la intercepta @modal/(.)editar; entrando por URL (o al recargar), @modal/editar.
// Va en este layout y no en el de alumnos: una carpeta interceptora con parámetro dinámico
// (@modal/(.)[alumnoId]) hace que Next pase alumnoId como "(.)3" al navegar al detalle.
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function AlumnoLayout({ children, modal }: LayoutProps<'/mesa/alumnos/[alumnoId]'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
