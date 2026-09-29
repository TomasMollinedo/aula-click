// El slot @modal muestra el alta siempre como modal encima del listado: navegando desde él lo
// intercepta @modal/(.)nueva; entrando por URL (o al recargar), @modal/nueva, con el listado de
// fondo en children. El detalle (?detalle=<id>) y la edición (?editar=<id>, desde el lápiz o el
// detalle) son parámetros de MateriasListado: no tienen página propia (decisión T-34).
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function MateriasLayout({ children, modal }: LayoutProps<'/gerente/materias'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
