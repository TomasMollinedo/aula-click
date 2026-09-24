import type { Auditoria } from '@/types'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { cn } from '@/utils/cn'

/**
 * Quién creó el registro y quién lo modificó por última vez, con fecha y hora local. Es la misma
 * línea en el detalle de toda entidad (docs/contrato-api.md → Recursos individuales).
 */
function Trazabilidad({ auditoria, className }: { auditoria: Auditoria; className?: string }) {
  return (
    <div
      data-slot="trazabilidad"
      className={cn('text-muted-foreground space-y-1 text-xs', className)}
    >
      <p>
        Creado por {nombreUsuarioAuditoria(auditoria.createdBy)} ·{' '}
        {formatoInstante(auditoria.createdAt)}
      </p>
      <p>
        Última modificación por {nombreUsuarioAuditoria(auditoria.updatedBy)} ·{' '}
        {formatoInstante(auditoria.updatedAt)}
      </p>
    </div>
  )
}

export { Trazabilidad }
