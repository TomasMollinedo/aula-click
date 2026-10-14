import { KeyRound } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/** "Configuración" del portal: cambiar la contraseña (HU-28). La completa T-92. */
export function CambiarContrasena() {
  return (
    <Card className="p-0">
      <EmptyState icon={KeyRound} title="Próximamente" />
    </Card>
  )
}
