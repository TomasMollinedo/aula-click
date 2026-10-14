import { PageHeader } from '@/components/layout/page-header'
import { CambiarContrasena } from '@/features/usuarios/components/CambiarContrasena'

// La completa T-92.
export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" />
      <CambiarContrasena />
    </div>
  )
}
