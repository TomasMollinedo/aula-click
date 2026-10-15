'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, RotateCw } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, fieldErrorId } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { cn } from '@/utils/cn'
import { ApiError } from '@/utils/fetch-json'
import { formatearPorcentaje } from '@/utils/porcentaje'

import { useCambiarPorcentaje } from '../hooks/use-cambiar-porcentaje'
import { usePorcentajeCentro } from '../hooks/use-porcentaje-centro'
import {
  PORCENTAJE_FORM_VACIO,
  type PorcentajeFormValues,
  leerPorcentaje,
  porcentajeFormSchema,
} from '../reparto.schema'

const PAGE_SIZE = 10

/** Mensaje del 400 `VALIDACION` en `porcentaje` (rango o "ya es X %"): va en el campo. */
function errorDelCampo(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 400 || error.code !== 'VALIDACION') {
    return null
  }
  const details = Array.isArray(error.details)
    ? (error.details as { path?: unknown; message?: string }[])
    : []
  const detalle = details.find((d) => Array.isArray(d.path) && d.path[0] === 'porcentaje')
  return detalle ? (detalle.message ?? error.message) : null
}

/** Cualquier otro error del PUT: se muestra en el diálogo, que queda abierto para reintentar. */
function errorDelDialogo(error: unknown): string {
  if (error instanceof ApiError && error.status === 403 && error.code === 'SIN_PERMISO') {
    return 'No tenés permiso para cambiar el porcentaje del centro'
  }
  if (error instanceof ApiError && error.status < 500) return error.message
  return 'No se pudo guardar el porcentaje. Revisá la conexión e intentá de nuevo.'
}

/**
 * Porcentaje del centro (HU-43), en `/gerente/configuracion`: el vigente, el cambio con
 * confirmación y el historial paginado (`?page=` en la URL).
 */
export function PorcentajeCentro() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()

  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const irAPagina = (nueva: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nueva > 1) params.set('page', String(nueva))
    else params.delete('page')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const query = usePorcentajeCentro({ page, pageSize: PAGE_SIZE })
  const cambiar = useCambiarPorcentaje()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<PorcentajeFormValues>({
    resolver: zodResolver(porcentajeFormSchema),
    defaultValues: PORCENTAJE_FORM_VACIO,
  })

  // El valor que se va a mandar, fijado al abrir: si el campo cambia detrás, el diálogo no cambia.
  const [aConfirmar, setAConfirmar] = useState<number | null>(null)
  // Al cerrar por un error del campo, el foco va al campo y no al botón que abrió el diálogo.
  const enfocarCampo = useRef(false)

  const guardar = handleSubmit(({ porcentaje }) => {
    const lectura = leerPorcentaje(porcentaje)
    if (!lectura.ok) return
    cambiar.reset()
    setAConfirmar(lectura.valor)
  })

  const confirmar = () => {
    if (aConfirmar === null) return
    cambiar.mutate(aConfirmar, {
      onSuccess: (vigente) => {
        setAConfirmar(null)
        reset(PORCENTAJE_FORM_VACIO)
        toast.success(
          `Porcentaje del centro actualizado a ${formatearPorcentaje(vigente.porcentaje)}`,
        )
        if (page !== 1) irAPagina(1)
      },
      onError: (error) => {
        const mensaje = errorDelCampo(error)
        if (mensaje === null) return
        enfocarCampo.current = true
        setAConfirmar(null)
        setError('porcentaje', { message: mensaje })
      },
    })
  }

  const mensajeDialogo =
    cambiar.error && errorDelCampo(cambiar.error) === null ? errorDelDialogo(cambiar.error) : null

  if (query.isPending) {
    return (
      <Card>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full" />
      </Card>
    )
  }

  if (query.isError) {
    const sinPermiso = query.error.status === 403
    return (
      <Card>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive flex flex-wrap items-center gap-3">
            {sinPermiso
              ? 'No tenés permiso para ver el porcentaje del centro'
              : 'No se pudo cargar el porcentaje del centro. Revisá la conexión e intentá de nuevo.'}
            {!sinPermiso && (
              <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
                <RotateCw />
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </Card>
    )
  }

  const { vigente, historial } = query.data
  const { meta } = historial
  const errorCampo = errors.porcentaje?.message

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold">
            El centro retiene el {formatearPorcentaje(vigente.porcentaje)} de cada turno cobrado
          </p>
          <p className="text-muted-foreground text-sm">
            Desde el {formatoInstante(vigente.desde)} ·{' '}
            {nombreUsuarioAuditoria(vigente.cambiadoPor)}
          </p>
        </div>

        <form onSubmit={guardar} noValidate className="flex items-start gap-3">
          <Field
            label="Nuevo porcentaje"
            htmlFor="porcentaje-centro"
            error={errorCampo}
            className="flex-1"
          >
            <div className="relative">
              <Input
                id="porcentaje-centro"
                inputMode="decimal"
                autoComplete="off"
                className="pr-8"
                aria-invalid={errorCampo ? true : undefined}
                aria-describedby={errorCampo ? fieldErrorId('porcentaje-centro') : undefined}
                {...register('porcentaje')}
              />
              <span
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm"
              >
                %
              </span>
            </div>
          </Field>
          {/* Alineado con el input: el label ocupa la primera línea del campo. */}
          <Button type="submit" variant="confirmado" size="lg" className="mt-7">
            Guardar
          </Button>
        </form>
      </div>

      <div className="border-border border-t">
        <h2 className="px-6 pt-5 pb-2 font-semibold">Historial</h2>
        <Table aria-busy={query.isFetching} className={cn(query.isPlaceholderData && 'opacity-60')}>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Porcentaje</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="pr-6">Cambiado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historial.data.map((fila, i) => (
              <TableRow key={fila.id}>
                <TableCell className="pl-6">
                  <span className="flex items-center gap-2">
                    {formatearPorcentaje(fila.porcentaje)}
                    {meta.page === 1 && i === 0 && <Badge variant="confirmado">Vigente</Badge>}
                  </span>
                </TableCell>
                <TableCell>{formatoInstante(fila.desde)}</TableCell>
                <TableCell className="pr-6">{nombreUsuarioAuditoria(fila.cambiadoPor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta.total > 0 && (
        <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Mostrando {(meta.page - 1) * meta.pageSize + 1}–
            {Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}
          </p>
          <PaginationControls page={page} totalPages={meta.totalPages} onPageChange={irAPagina} />
        </div>
      )}

      <Dialog
        open={aConfirmar !== null}
        onOpenChange={(open) => !open && !cambiar.isPending && setAConfirmar(null)}
      >
        <DialogContent
          onCloseAutoFocus={(e) => {
            if (!enfocarCampo.current) return
            enfocarCampo.current = false
            e.preventDefault()
            setFocus('porcentaje')
          }}
        >
          <DialogHeader>
            <DialogTitle>Cambiar el porcentaje del centro</DialogTitle>
            <DialogDescription>
              {aConfirmar !== null &&
                `Desde ahora, el centro retendrá el ${formatearPorcentaje(aConfirmar)} de cada turno cobrado. Los cobros ya registrados conservan su porcentaje.`}
            </DialogDescription>
          </DialogHeader>

          {mensajeDialogo && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-destructive">{mensajeDialogo}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAConfirmar(null)}
              disabled={cambiar.isPending}
            >
              Cancelar
            </Button>
            <Button variant="confirmado" onClick={confirmar} disabled={cambiar.isPending}>
              {cambiar.isPending ? 'Guardando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
