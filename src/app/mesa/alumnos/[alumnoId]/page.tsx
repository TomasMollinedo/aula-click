'use client'

import { use } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { useAlumno } from '@/features/alumnos/hooks/use-alumno'

export default function DetalleAlumnoPage({ params }: { params: Promise<{ alumnoId: string }> }) {
  const { alumnoId } = use(params)
  const id = Number(alumnoId)

  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    return <NoEncontrado />
  }

  return <DetalleContenido id={id} />
}

function DetalleContenido({ id }: { id: number }) {
  const { data: alumno, isLoading, isError, error } = useAlumno(id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    if (error?.status === 404) return <NoEncontrado />
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{error?.message ?? 'Ocurrió un error inesperado'}</AlertDescription>
      </Alert>
    )
  }

  if (!alumno) return <NoEncontrado />

  return <AlumnoDetalle alumno={alumno} />
}

function NoEncontrado() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <p className="text-muted-foreground">Alumno no encontrado</p>
      <Button variant="outline" asChild>
        <Link href="/mesa/alumnos">Volver al listado</Link>
      </Button>
    </div>
  )
}
