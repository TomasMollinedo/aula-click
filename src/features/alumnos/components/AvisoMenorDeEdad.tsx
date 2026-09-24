import { Badge } from '@/components/ui/badge'

export function AvisoMenorDeEdad({ modo }: { modo: 'crear' | 'editar' }) {
  return (
    <div role="status" className="bg-canvas border-border rounded-xl border px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="accent">Menor de edad</Badge>
        <p className="text-sm">Según la fecha de nacimiento, este alumno es menor de edad.</p>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Por eso se requieren los datos del tutor o responsable para continuar{' '}
        {modo === 'crear' ? 'con el alta' : 'con la edición'}.
      </p>
    </div>
  )
}
