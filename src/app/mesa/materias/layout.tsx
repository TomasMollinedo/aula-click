// El slot @modal muestra el alta siempre como modal encima del listado: navegando desde él lo
// intercepta @modal/(.)nueva; entrando por URL (o al recargar), @modal/nueva, con el listado de
// fondo en children. El detalle es ?detalle=<id> en MateriasListado (no tiene página propia,
// decisión T-34) y en este sprint no hay edición.
// docs/arquitectura-frontend.md → Modales con URL propia.
export default function MateriasLayout({ children, modal }: LayoutProps<'/mesa/materias'>) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
