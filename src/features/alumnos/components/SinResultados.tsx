'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type SinResultadosProps = {
  q: string
}

export function SinResultados({ q }: SinResultadosProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <p className="text-muted-foreground">
        {q ? `No se encontraron alumnos para «${q}»` : 'Todavía no hay alumnos cargados'}
      </p>
      <Button asChild>
        <Link href="/mesa/alumnos/nuevo">
          <Plus className="size-4" />
          Nuevo alumno
        </Link>
      </Button>
    </div>
  )
}
