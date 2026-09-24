// El slot @modal muestra el alta siempre como modal encima del listado: navegando desde él lo
// intercepta @modal/(.)nuevo; entrando por URL (o al recargar), @modal/nuevo, con el listado de
// fondo en children. También la edición desde el lápiz de una fila (@modal/(.)[alumnoId]/editar);
// desde la página de detalle, la edición tiene su propio slot en [alumnoId]/layout.tsx.
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function AlumnosLayout({ children, modal }: LayoutProps<'/mesa/alumnos'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
