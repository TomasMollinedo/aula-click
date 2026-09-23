'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { detalleAValoresForm } from '@/features/alumnos/alumnos.schema'
import type { AlumnoEditar } from '@/features/alumnos/alumnos.types'
import { AlumnoForm } from '@/features/alumnos/components/AlumnoForm'
import { useAlumno } from '@/features/alumnos/hooks/use-alumno'
import { useEditarAlumno } from '@/features/alumnos/hooks/use-editar-alumno'

export default function EditarAlumnoPage({ params }: { params: Promise<{ alumnoId: string }> }) {
  const { alumnoId } = use(params)
  const id = Number(alumnoId)

  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    return <NoEncontrado />
  }

  return <EditarContenido id={id} />
}

function EditarContenido({ id }: { id: number }) {
  const router = useRouter()
  const { data: alumno, isLoading, isError, error } = useAlumno(id)
  const mutation = useEditarAlumno(id)
  const [sinCambios, setSinCambios] = useState(false)

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
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

  function handleSubmit(cambios: AlumnoEditar | null) {
    if (!cambios) {
      setSinCambios(true)
      return
    }
    setSinCambios(false)
    mutation.mutate(cambios, {
      onSuccess: () => {
        router.push(`/mesa/alumnos/${id}`)
      },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Editar alumno</h1>
      {sinCambios && (
        <Alert>
          <AlertDescription>No hay cambios para guardar</AlertDescription>
        </Alert>
      )}
      <AlumnoForm
        modo="editar"
        defaultValues={detalleAValoresForm(alumno)}
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </div>
  )
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
