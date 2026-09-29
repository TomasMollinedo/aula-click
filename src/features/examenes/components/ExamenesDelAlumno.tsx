'use client'

import { Card } from '@/components/ui/card'
import type { Role } from '@/types'

export type ExamenesDelAlumnoProps = {
  alumnoId: number
  /** Rol de quien mira: mesa de entradas administra los exámenes, el profesor solo los ve. */
  rol: Role
}

/** PLACEHOLDER de T-35, lo completa T-56: pestaña "Exámenes" de la ficha del alumno. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function ExamenesDelAlumno(_props: ExamenesDelAlumnoProps) {
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        Los exámenes del alumno estarán disponibles próximamente.
      </p>
    </Card>
  )
}
