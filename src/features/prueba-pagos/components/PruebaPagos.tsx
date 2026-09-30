'use client'

// TEMPORAL (T-52): arnés para probar el registro de pagos mientras no existen el detalle del turno
// (T-44) ni la pestaña "Pagos" (T-54). Se borra entero, junto con `src/app/mesa/prueba-pagos/`,
// cuando esas tareas permitan probar el pago desde la app. No es una pantalla del producto: no está
// en el Sidebar, se entra por URL (`/mesa/prueba-pagos`).
//
// Toma ocurrencias reales de la agenda diaria (`useAgenda`) y el precio vigente de cada materia,
// y abre lo que compone `app/` por render props (una feature no importa componentes de otra):
// - `renderRegistrarPago`: el diálogo con las ocurrencias elegidas, como lo abriría `cuentas`;
// - `renderAccionRegistrarPago`: la acción del pie del detalle, dentro de un detalle simulado. La
//   acción se oculta cuando la agenda se vuelve a pedir (el pago la invalida), como hará el detalle
//   real de T-44: así se prueba que el diálogo sobrevive a la invalidación.

import { type ReactNode, useState } from 'react'
import { format } from 'date-fns'
import { AlertCircle, FlaskConical } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DetalleModal } from '@/components/ui/detalle-modal'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAgenda } from '@/features/agendas/hooks/use-agenda'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import type { OcurrenciaACobrar, SolicitudRegistrarPago } from '@/types/pago'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import { usePreciosMaterias } from '../hooks/use-precios-materias'

type Fila = OcurrenciaACobrar & { alumno: { id: number; nombre: string; apellido: string } }

type PruebaPagosProps = {
  renderRegistrarPago: (solicitud: SolicitudRegistrarPago) => ReactNode
  renderAccionRegistrarPago: (props: { ocurrencia: OcurrenciaDetalle }) => ReactNode
}

const clave = (o: { turnoId: number; fecha: string }) => `${o.turnoId}|${o.fecha}`

export function PruebaPagos({ renderRegistrarPago, renderAccionRegistrarPago }: PruebaPagosProps) {
  const [fecha, setFecha] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [seleccion, setSeleccion] = useState<Fila[]>([])
  const [solicitud, setSolicitud] = useState<Omit<SolicitudRegistrarPago, 'onCerrar'> | null>(null)
  const [detalle, setDetalle] = useState<{ fila: Fila; agendaDe: number } | null>(null)

  const agenda = useAgenda({ fecha, page: 1, pageSize: 100 })
  const precios = usePreciosMaterias()

  const filas: Fila[] = (agenda.data?.data ?? [])
    .filter((item) => item.estado === 'ACTIVO')
    .map((item) => ({
      turnoId: item.id,
      fecha,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
      materia: item.materia,
      profesor: item.profesor,
      alumno: item.alumno,
      importe: precios.data?.get(item.materia.id) ?? null,
    }))

  const elegidas = new Set(seleccion.map(clave))
  const alternar = (fila: Fila) =>
    setSeleccion((actual) =>
      elegidas.has(clave(fila))
        ? actual.filter((o) => clave(o) !== clave(fila))
        : [...actual, fila],
    )

  const abrirRegistro = () => {
    const [primera] = seleccion
    if (!primera) return
    // Copia de la selección: el diálogo la conserva aunque la agenda se invalide (T-67).
    setSolicitud({
      alumnoId: primera.alumno.id,
      ocurrencias: [...seleccion],
    })
  }

  // La acción del detalle simulado es visible hasta que la agenda se vuelve a pedir.
  const accionVisible = detalle !== null && agenda.dataUpdatedAt === detalle.agendaDe

  return (
    <div className="space-y-6">
      <Alert>
        <FlaskConical className="size-4" />
        <AlertTitle>Pantalla temporal de prueba (T-52)</AlertTitle>
        <AlertDescription>
          Sirve para probar el registro de pagos con datos reales mientras no existen el detalle del
          turno (T-44) ni la pestaña de pagos (T-54). Los pagos que se registran acá son reales. Se
          borra cuando esas tareas estén hechas.
        </AlertDescription>
      </Alert>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Fecha de la agenda" htmlFor="prueba-fecha" className="w-48">
            <Input
              id="prueba-fecha"
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
            />
          </Field>
          <p className="text-muted-foreground max-w-xl text-sm">
            Elegí ocurrencias de uno o varios días (la selección se conserva al cambiar de fecha).
            El alumno del pago es el de la primera elegida: sumar una de otro alumno prueba el 400
            &quot;El turno no es del alumno&quot;. Una fecha a más de 8 semanas prueba el 409.
          </p>
        </div>

        {(agenda.error || precios.error) && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive">
              {(agenda.error ?? precios.error)?.message}
            </AlertDescription>
          </Alert>
        )}

        {agenda.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-3">
                  <span className="sr-only">Elegir</span>
                </TableHead>
                <TableHead className="px-3">Horario</TableHead>
                <TableHead className="px-3">Alumno</TableHead>
                <TableHead className="px-3">Materia</TableHead>
                <TableHead className="px-3">Profesor</TableHead>
                <TableHead className="px-3">Precio (API)</TableHead>
                <TableHead className="px-3">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground px-3 text-center">
                    Sin turnos ese día
                  </TableCell>
                </TableRow>
              )}
              {filas.map((fila) => (
                <TableRow key={clave(fila)}>
                  <TableCell className="px-3 py-2">
                    <Checkbox
                      checked={elegidas.has(clave(fila))}
                      onCheckedChange={() => alternar(fila)}
                      aria-label={`Elegir el turno ${fila.turnoId} de ${fila.alumno.nombre} ${fila.alumno.apellido}`}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {rangoHoras(fila.horaInicio, fila.horaFin)}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {fila.alumno.nombre} {fila.alumno.apellido}{' '}
                    <span className="text-muted-foreground">#{fila.alumno.id}</span>
                  </TableCell>
                  <TableCell className="px-3 py-2">{fila.materia.nombre}</TableCell>
                  <TableCell className="px-3 py-2">
                    {fila.profesor.nombre} {fila.profesor.apellido}
                  </TableCell>
                  <TableCell className="px-3 py-2">{fila.importe ?? 'Sin precio'}</TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetalle({ fila, agendaDe: agenda.dataUpdatedAt })}
                    >
                      Detalle simulado
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm">
            {seleccion.length === 0
              ? 'Ninguna ocurrencia elegida'
              : `Elegidas: ${seleccion
                  .map((o) => `#${o.turnoId} ${fechaConDia(o.fecha)} (${o.alumno.apellido})`)
                  .join(', ')}`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSeleccion([])}
              disabled={seleccion.length === 0}
            >
              Quitar selección
            </Button>
            <Button onClick={abrirRegistro} disabled={seleccion.length === 0}>
              Registrar pago
            </Button>
          </div>
        </div>
      </Card>

      {solicitud && renderRegistrarPago({ ...solicitud, onCerrar: () => setSolicitud(null) })}

      {detalle && (
        <DetalleModal
          titulo="Detalle del turno (simulado)"
          descripcion={`Acción "Registrar pago" visible: ${accionVisible ? 'sí' : 'no (la agenda se volvió a pedir)'}`}
          onCerrar={() => setDetalle(null)}
          acciones={renderAccionRegistrarPago({
            ocurrencia: detalleSimulado(detalle.fila, accionVisible),
          })}
        >
          <p className="text-sm">
            Turno #{detalle.fila.turnoId} del {fechaConDia(detalle.fila.fecha)},{' '}
            {rangoHoras(detalle.fila.horaInicio, detalle.fila.horaFin)},{' '}
            {detalle.fila.materia.nombre} con {detalle.fila.profesor.nombre}{' '}
            {detalle.fila.profesor.apellido}. Alumno: {detalle.fila.alumno.nombre}{' '}
            {detalle.fila.alumno.apellido}.
          </p>
        </DetalleModal>
      )}
    </div>
  )
}

/** Un `OcurrenciaDetalle` armado con lo mínimo que usa `AccionRegistrarPago` (el resto, de relleno). */
function detalleSimulado(fila: Fila, registrarPagoVisible: boolean): OcurrenciaDetalle {
  return {
    turnoId: fila.turnoId,
    fechaOriginal: fila.fecha,
    fecha: fila.fecha,
    diaSemana: 1,
    horaInicio: fila.horaInicio,
    horaFin: fila.horaFin,
    tipo: 'RECURRENTE',
    estado: 'AGENDADO',
    alumno: { ...fila.alumno, dni: '' },
    profesor: fila.profesor,
    materia: fila.materia,
    aula: { id: 0, nombre: '' },
    observaciones: null,
    temas: null,
    serie: { fechaInicio: fila.fecha, fechaFin: null, fechasReprogramadas: [], finalizacion: null },
    pago:
      fila.importe === null
        ? {
            estado: 'PAGADO',
            pagoId: 0,
            numeroComprobante: 0,
            importe: 0,
            formaPago: '',
            fecha: fila.fecha,
            registro: { por: null, en: '' },
          }
        : { estado: 'PENDIENTE', importeVigente: fila.importe },
    cancelacion: null,
    reprogramacion: null,
    prioridad: null,
    examen: null,
    acciones: {
      cancelar: { visible: false, habilitada: false },
      finalizar: { visible: false },
      reprogramar: { visible: false },
      registrarPago: { visible: registrarPagoVisible },
    },
    createdAt: '',
    updatedAt: '',
    createdBy: null,
    updatedBy: null,
  }
}
