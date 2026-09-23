import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlumnosListado } from '@/features/alumnos/components/AlumnosListado'

export default function AlumnosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alumnos</h1>
        <Button asChild>
          <Link href="/mesa/alumnos/nuevo">
            <Plus className="size-4" />
            Nuevo alumno
          </Link>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AlumnosListado />
      </Suspense>
    </div>
  )
}
