'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Pencil } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'
import { getInitials } from '@/utils/initials'

import type { AlumnoListadoItem, AlumnoMateria } from '../alumnos.types'

type AlumnoCardProps = {
  /** Con `materias` (listado "Mis alumnos" del profesor) la tarjeta las muestra debajo del DNI. */
  alumno: AlumnoListadoItem & { materias?: AlumnoMateria[] }
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
  /** URL que abre la edición de un alumno como modal encima del listado. Sin ella, no hay lápiz. */
  hrefEditar?: (id: number) => string
  /** Se llama al abrir la edición con el lápiz en esta pestaña (no con Cmd/Ctrl+clic). */
  onEditar?: () => void
}

/** Acciones de la tarjeta (ver detalle, editar): ícono sin relleno; el color lo pone cada una. */
const accionDeTarjeta =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

// Tarjeta del listado (HU-26), calcada de ProfesorCard. Los alumnos no tienen baja en este release:
// sin badge de estado ni acción de baja, solo ver detalle y editar.
export function AlumnoCard({ alumno, rutaBase, hrefEditar, onEditar }: AlumnoCardProps) {
  const router = useRouter()
  const href = `${rutaBase}/${alumno.id}`

  return (
    // La tarjeta entera abre el detalle con el mouse. Los links del ojo y del lápiz son el acceso
    // de teclado y los que permiten abrir en otra pestaña.
    <Card
      className="hover:ring-cobalto/30 cursor-pointer items-center gap-4 p-5 transition-shadow hover:shadow-md"
      onClick={(e) => {
        // El clic sobre el link ya navega (y respeta Cmd/Ctrl+clic): no duplicarlo.
        if ((e.target as HTMLElement).closest('a')) return
        router.push(href)
      }}
    >
      <div className="flex w-full min-w-0 flex-col items-center gap-3">
        {/* La foto guardada es una URL prefirmada de MinIO: va con Avatar, no con next/image. */}
        <Avatar className="size-28 rounded-xl">
          {alumno.fotoUrl && <AvatarImage src={alumno.fotoUrl} alt="" />}
          <AvatarFallback className="bg-cobalto/10 text-cobalto rounded-xl text-3xl font-semibold">
            {getInitials(alumno.nombre, alumno.apellido)}
          </AvatarFallback>
        </Avatar>
        <div className="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
          <span className="w-full text-lg leading-tight font-semibold break-words">
            {alumno.apellido}
          </span>
          <span className="text-muted-foreground w-full text-sm break-words">{alumno.nombre}</span>
          <span className="text-muted-foreground text-sm tabular-nums">DNI {alumno.dni}</span>
        </div>
        {alumno.materias && alumno.materias.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {alumno.materias.map((materia) => (
              <Badge key={materia.id} variant="secondary">
                {materia.nombre}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="border-border mt-auto flex w-full items-center justify-center gap-1 border-t pt-3">
        <Link
          href={href}
          aria-label={`Ver detalle de ${alumno.nombre} ${alumno.apellido}`}
          title="Ver detalle"
          className={cn(accionDeTarjeta, 'text-cobalto hover:bg-cobalto/10')}
        >
          <Eye className="size-5" />
        </Link>
        {/* Dorado, como el "Editar" del detalle. Con `urgente`, el dorado oscuro de la paleta: el
            `dorado` sobre blanco no llega al contraste 3:1 de un ícono. */}
        {hrefEditar && (
          <Link
            href={hrefEditar(alumno.id)}
            scroll={false}
            onClick={(e) => {
              // Cmd/Ctrl/Shift+clic abre otra pestaña: esta no abrió el modal.
              if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) onEditar?.()
            }}
            aria-label={`Editar a ${alumno.nombre} ${alumno.apellido}`}
            title="Editar"
            className={cn(accionDeTarjeta, 'text-urgente hover:bg-dorado/15')}
          >
            <Pencil className="size-5" />
          </Link>
        )}
      </div>
    </Card>
  )
}
