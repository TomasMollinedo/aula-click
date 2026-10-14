'use client'

import { use } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { MisExamenes } from '@/features/examenes/components/MisExamenes'
import { MiMateria } from '@/features/historiales/components/MiMateria'

// Client Component: le pasa una función (los exámenes, de otra feature). La completa T-111.
export default function MiMateriaPage({
  params,
}: PageProps<'/portal/materias/[materiaId]/[profesorId]'>) {
  const { materiaId, profesorId } = use(params)
  return (
    <div className="space-y-6">
      <PageHeader title="Mi materia" />
      <MiMateria
        materiaId={Number(materiaId)}
        profesorId={Number(profesorId)}
        renderExamenes={(solicitud) => <MisExamenes {...solicitud} />}
      />
    </div>
  )
}
