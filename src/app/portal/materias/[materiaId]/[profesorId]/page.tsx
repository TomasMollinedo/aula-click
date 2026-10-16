'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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
      <Link
        href="/portal/materias"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-4" />
        Volver a mis materias
      </Link>
      <PageHeader title="Mi materia" />
      <MiMateria
        materiaId={Number(materiaId)}
        profesorId={Number(profesorId)}
        renderExamenes={(solicitud) => <MisExamenes {...solicitud} />}
      />
    </div>
  )
}
