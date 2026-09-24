import { type VariantProps } from 'class-variance-authority'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import type { ComponentProps } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { getPageRange } from '@/utils/page-range'

function Pagination({ className, ...props }: ComponentProps<'nav'>) {
  return (
    // Sin centrado ni ancho forzado: quien la usa decide la alineación (por ejemplo, con
    // "Mostrando X de Y" a la izquierda, en un contenedor justify-between).
    <nav
      aria-label="Paginación"
      data-slot="pagination"
      className={cn('flex', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem(props: ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<VariantProps<typeof buttonVariants>, 'size'> &
  ComponentProps<'button'>

function PaginationLink({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({ variant: isActive ? 'default' : 'ghost', size }),
        'rounded-lg',
        !isActive && 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function PaginationPrevious({ className, ...props }: ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Página anterior"
      className={cn('border-border border', className)}
      {...props}
      size="icon"
    >
      <ChevronLeft className="size-4" />
    </PaginationLink>
  )
}

function PaginationNext({ className, ...props }: ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Página siguiente"
      className={cn('border-border border', className)}
      {...props}
      size="icon"
    >
      <ChevronRight className="size-4" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Más páginas</span>
    </span>
  )
}

/**
 * Paginador numerado completo (anterior, números con puntos suspensivos, siguiente), armado con
 * las piezas de arriba. No renderiza nada con una sola página o ninguna.
 */
function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious onClick={() => onPageChange(page - 1)} disabled={page <= 1} />
        </PaginationItem>
        {getPageRange(page, totalPages).map((item, index) => (
          <PaginationItem key={item === 'ellipsis' ? `ellipsis-${index}` : item}>
            {item === 'ellipsis' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                isActive={item === page}
                aria-label={`Página ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export {
  Pagination,
  PaginationControls,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
