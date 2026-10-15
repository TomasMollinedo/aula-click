import { PageHeader } from '@/components/layout/page-header'
import { CambiarContrasena } from '@/features/usuarios/components/CambiarContrasena'

// Configuración del portal (HU-28, T-92): cambiar la contraseña. El título va a la izquierda, como
// en las otras pantallas; la tarjeta, angosta y centrada: es un formulario corto.
export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" />
      <div className="mx-auto max-w-lg">
        <CambiarContrasena />
      </div>
    </div>
  )
}
