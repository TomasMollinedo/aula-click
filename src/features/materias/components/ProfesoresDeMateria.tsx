'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { MateriaProfesor } from '../materias.types'

type ProfesoresDeMateriaProps = {
  profesores: MateriaProfesor[]
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaProfesores: string
}

/**
 * Lista de solo lectura de los profesores que dictan la materia, cada uno con enlace a su ficha
 * (desde donde se le puede desasignar, HU-04). La usan el detalle y el rechazo de la baja, que
 * muestran la misma lista.
 */
export function ProfesoresDeMateria({ profesores, rutaProfesores }: ProfesoresDeMateriaProps) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {profesores.map((profesor) => (
        <li key={profesor.id}>
          <Link
            href={`${rutaProfesores}/${profesor.id}`}
            className="hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{profesor.apellido}</span>, {profesor.nombre}
            </span>
            <Badge variant={profesor.estado === 'ACTIVO' ? 'confirmado' : 'secondary'}>
              {profesor.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
            </Badge>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
