import { SegmentoDeRol } from '@/features/auth/components/SegmentoDeRol'

// Documentos imprimibles de mesa de entradas (comprobante de pago; T-60 suma `/…/imprimir`): la
// misma URL que el segmento (`/mesa/...`), pero sin el `AppShell` de `app/mesa/layout.tsx`, para
// que el Sidebar no aparezca ni antes de imprimir. El route group `(documentos)` solo cambia el
// layout, no separa roles: el guard del rol es el mismo que en el resto de `/mesa`
// (docs/arquitectura-frontend.md → Documentos imprimibles).
export default function DocumentosMesaLayout({ children }: LayoutProps<'/mesa'>) {
  return <SegmentoDeRol rol="MESA_ENTRADAS">{children}</SegmentoDeRol>
}
