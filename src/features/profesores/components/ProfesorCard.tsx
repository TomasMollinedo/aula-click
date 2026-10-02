'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Pencil, Trash2, Undo2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'
import { getInitials } from '@/utils/initials'

import type { ProfesorListadoItem } from '../profesores.types'

type ProfesorCardProps = {
  profesor: ProfesorListadoItem
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
  /** URL que abre la edición de un profesor como modal encima del listado. */
  hrefEditar: (id: number) => string
  /** Se llama al abrir la edición con el lápiz en esta pestaña (no con Cmd/Ctrl+clic). */
  onEditar: () => void
  /** Abre la confirmación de baja (profesor activo) o de reactivación (inactivo). */
  onCambiarEstado: (profesor: ProfesorListadoItem) => void
}

/** Acciones de la tarjeta (ver detalle, editar): ícono sin relleno; el color lo pone cada una. */
const accionDeTarjeta =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

export function ProfesorCard({
  profesor,
  rutaBase,
  hrefEditar,
  onEditar,
  onCambiarEstado,
}: ProfesorCardProps) {
  const router = useRouter()
  const href = `${rutaBase}/${profesor.id}`
  const activo = profesor.estado === 'ACTIVO'

  return (
    // La tarjeta entera abre el detalle con el mouse. Los links del ojo y del lápiz son el acceso
    // de teclado y los que permiten abrir en otra pestaña; la baja no abre el detalle.
    <Card
      className="hover:ring-cobalto/30 cursor-pointer items-center gap-4 p-5 transition-shadow hover:shadow-md"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) return
        router.push(href)
      }}
    >
      <div
        className={cn('flex w-full min-w-0 flex-col items-center gap-3', !activo && 'opacity-60')}
      >
        <Avatar className="size-28 rounded-xl">
          {profesor.fotoUrl && <AvatarImage src={profesor.fotoUrl} alt="" />}
          <AvatarFallback className="bg-cobalto/10 text-cobalto rounded-xl text-3xl font-semibold">
            {getInitials(profesor.nombre, profesor.apellido)}
          </AvatarFallback>
        </Avatar>
        <div className="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
          <span className="w-full text-lg leading-tight font-semibold break-words">
            {profesor.apellido}
          </span>
          <span className="text-muted-foreground w-full text-sm break-words">
            {profesor.nombre}
          </span>
          <span className="text-muted-foreground text-sm tabular-nums">DNI {profesor.dni}</span>
        </div>
      </div>

      <Badge variant={activo ? 'confirmado' : 'secondary'}>{activo ? 'Activo' : 'Inactivo'}</Badge>

      <div className="border-border mt-auto flex w-full items-center justify-center gap-1 border-t pt-3">
        <Link
          href={href}
          aria-label={`Ver detalle de ${profesor.nombre} ${profesor.apellido}`}
          title="Ver detalle"
          className={cn(accionDeTarjeta, 'text-cobalto hover:bg-cobalto/10')}
        >
          <Eye className="size-5" />
        </Link>
        <Link
          href={hrefEditar(profesor.id)}
          scroll={false}
          onClick={(e) => {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) onEditar()
          }}
          aria-label={`Editar a ${profesor.nombre} ${profesor.apellido}`}
          title="Editar"
          className={cn(accionDeTarjeta, 'text-urgente hover:bg-dorado/15')}
        >
          <Pencil className="size-5" />
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCambiarEstado(profesor)
          }}
          aria-label={
            activo
              ? `Dar de baja a ${profesor.nombre} ${profesor.apellido}`
              : `Reactivar a ${profesor.nombre} ${profesor.apellido}`
          }
          title={activo ? 'Dar de baja' : 'Reactivar'}
          className={cn(
            accionDeTarjeta,
            activo
              ? 'text-cancelado hover:bg-cancelado/10'
              : 'text-confirmado hover:bg-confirmado/10',
          )}
        >
          {activo ? <Trash2 className="size-5" /> : <Undo2 className="size-5" />}
        </button>
      </div>
    </Card>
  )
}
