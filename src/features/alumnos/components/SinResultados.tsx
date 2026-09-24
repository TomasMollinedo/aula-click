'use client'

import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

type SinResultadosProps = {
  q: string
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
}

export function SinResultados({ q, rutaBase }: SinResultadosProps) {
  return (
    <EmptyState
      icon={q ? Search : Users}
      title={q ? `No se encontraron alumnos para «${q}»` : 'Todavía no hay alumnos cargados'}
      description={q ? 'Probá con otro DNI, nombre o apellido.' : 'Dá de alta el primero.'}
      className="py-20"
    >
      <Button size="lg" asChild>
        <Link href={`${rutaBase}/nuevo`}>
          <Plus />
          Dar de alta un nuevo alumno
        </Link>
      </Button>
    </EmptyState>
  )
}
