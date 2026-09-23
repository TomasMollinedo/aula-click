'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { AlumnoListadoItem } from '../alumnos.types'

type AlumnosTableProps = {
  data?: AlumnoListadoItem[]
  meta?: { page: number; totalPages: number }
  isLoading: boolean
  isError: boolean
  error: { message: string } | null
  page: number
  onPageChange: (page: number) => void
}

export function AlumnosTable({
  data,
  meta,
  isLoading,
  isError,
  error,
  page,
  onPageChange,
}: AlumnosTableProps) {
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{error?.message ?? 'Ocurrió un error inesperado'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Apellido</TableHead>
            <TableHead>Nombre</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                </TableRow>
              ))
            : data?.map((alumno) => (
                <TableRow key={alumno.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/mesa/alumnos/${alumno.id}`} className="block w-full">
                      {alumno.apellido}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/mesa/alumnos/${alumno.id}`} className="block w-full">
                      {alumno.nombre}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Página {meta.page} de {meta.totalPages}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => onPageChange(page - 1)} disabled={page <= 1} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= meta.totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
