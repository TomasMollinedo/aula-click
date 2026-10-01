'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarSearch, DoorOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import { useToast } from '@/hooks/use-toast'
import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import { diaSemanaDeFecha, nombreDiaSemana } from '@/utils/dias-semana'

import {
  type ErrorReprogramacion,
  interpretarErrorReprogramacion,
} from '../errores-reprogramaciones'
import { textoCambio } from '../formato-reprogramaciones'
import { avisoHoraCompleta, textoHorario } from '../formato-turnos'
import { useDisponibilidad } from '../hooks/use-disponibilidad'
import { useInvalidarDisponibilidad } from '../hooks/use-invalidar-disponibilidad'
import { useReprogramarTurno } from '../hooks/use-reprogramar-turno'
import { buscarBloque, claveBloque } from '../seleccion-turno'
import { esFechaConFormato } from '../turnos.schema'
import type { BloqueDisponible } from '../turnos.types'
import {
  FILTROS_VACIOS,
  type FiltrosBusqueda,
  FiltrosDisponibilidad,
} from './FiltrosDisponibilidad'
import { HorasDelBloque } from './HorasDelBloque'
import { AlertaRechazo } from './RechazoAlta'
import { ResultadosDisponibilidad } from './ResultadosDisponibilidad'

export type ReprogramarTurnoDialogProps = {
  /** La ocurrencia que se mueve; con `open` en `false` no se usa. */
  ocurrencia: OcurrenciaDetalle
  open: boolean
  /** Cierra el diálogo (Cancelar, la X o después de reprogramar). */
  onCerrar: () => void
}

/**
 * "Reprogramar turno" (HU-20, `POST /reprogramaciones`): la misma búsqueda de horarios que
 * registrar turno, con el alumno y la materia fijos; profesor y día opcionales, una sola hora y la
 * fecha nueva. Antes de confirmar muestra el cambio. Al reprogramar abre el detalle con el
 * `turnoId` que devuelve la API y la fecha nueva: en un recurrente, la fecha movida es un turno
 * nuevo. No calcula reglas: lugar, superposiciones y fechas válidas las decide la API.
 */
export function ReprogramarTurnoDialog({
  open,
  onCerrar,
  ocurrencia,
}: ReprogramarTurnoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
        {/* Se monta al abrir: la búsqueda y el rechazo del intento anterior no sobreviven. */}
        <ContenidoReprogramar ocurrencia={ocurrencia} onCerrar={onCerrar} />
      </DialogContent>
    </Dialog>
  )
}

function ContenidoReprogramar({ ocurrencia, onCerrar }: Omit<ReprogramarTurnoDialogProps, 'open'>) {
  const router = useRouter()
  const toast = useToast()
  const reprogramar = useReprogramarTurno()
  const invalidarDisponibilidad = useInvalidarDisponibilidad()
  const { hrefDetalle } = useDetalleEnUrl()
  const materia = ocurrencia.materia

  // --- Búsqueda: la materia es la del turno.
  const [filtros, setFiltros] = useState<FiltrosBusqueda>({
    ...FILTROS_VACIOS,
    materiaId: materia.id,
  })
  const [claveElegida, setClaveElegida] = useState<string | null>(null)
  const disponibilidad = useDisponibilidad({
    materiaId: materia.id,
    diaSemana: filtros.diaSemana ?? undefined,
    profesorId: filtros.profesorId ?? undefined,
  })
  // Con la lista de los filtros anteriores (placeholder) no hay bloque elegido.
  const bloqueElegido =
    claveElegida !== null && !disponibilidad.isPlaceholderData
      ? buscarBloque(disponibilidad.data, claveElegida)
      : null

  // --- Hora y fecha nueva.
  const [horaId, setHoraId] = useState<number | null>(null)
  const [fecha, setFecha] = useState('')

  // La ocupación de la fecha elegida (misma materia y profesor, sin `diaSemana`: la API da 400 si
  // no coincide con la fecha). Es un refresco de lo que se ve; el lugar lo decide la reprogramación.
  const fechaRefresco =
    bloqueElegido && esFechaConFormato(fecha) && fecha !== bloqueElegido.fecha ? fecha : undefined
  const refresco = useDisponibilidad(
    { materiaId: materia.id, profesorId: bloqueElegido?.profesor.id, fecha: fechaRefresco },
    fechaRefresco !== undefined,
  )
  const matchRefresco =
    fechaRefresco !== undefined &&
    claveElegida !== null &&
    !refresco.isPlaceholderData &&
    !refresco.isError
      ? buscarBloque(refresco.data, claveElegida)
      : null
  const bloqueMostrado = bloqueElegido ? (matchRefresco ?? bloqueElegido) : null

  // Una hora que en la fecha elegida viene `lleno` (lo dice la API) no se puede elegir: queda
  // destildada y se avisa. Si la fecha vuelve a otra, la hora vuelve a estar elegida.
  const horaDelBloque = bloqueMostrado?.horas.find((hora) => hora.bloqueId === horaId) ?? null
  const horaLlena = horaDelBloque?.lleno === true
  const horaElegida = horaLlena ? null : horaDelBloque
  const fechaLista = bloqueElegido !== null && esFechaConFormato(fecha)
  const puedeContinuar = horaElegida !== null && fechaLista && !refresco.isFetching

  // --- Pasos y rechazo.
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [rechazo, setRechazo] = useState<ErrorReprogramacion | null>(null)

  const limpiarBloque = () => {
    setClaveElegida(null)
    setHoraId(null)
    setFecha('')
    setConfirmando(false)
    setRechazo(null)
  }

  const cambiarFiltros = (nuevos: FiltrosBusqueda) => {
    setFiltros({ ...nuevos, materiaId: materia.id })
    setAviso(null)
    limpiarBloque()
  }

  const elegirBloque = (bloque: BloqueDisponible) => {
    setClaveElegida(claveBloque(bloque))
    setAviso(null)
    setRechazo(null)
    setHoraId(null)
    // La fecha propuesta es la del resultado: la próxima ocurrencia que devolvió la API.
    setFecha(bloque.fecha)
  }

  const volverALaBusqueda = (mensaje: string | null = null) => {
    limpiarBloque()
    setAviso(mensaje)
    void invalidarDisponibilidad()
  }

  const cambio =
    bloqueMostrado && horaElegida && fechaLista
      ? textoCambio(ocurrencia, {
          fecha,
          horaInicio: horaElegida.horaInicio,
          horaFin: horaElegida.horaFin,
          profesor: bloqueMostrado.profesor,
        })
      : null

  const confirmar = () => {
    if (!horaElegida || !fechaLista) return
    reprogramar.mutate(
      {
        turnoId: ocurrencia.turnoId,
        fecha: ocurrencia.fecha,
        bloqueAgendaDestinoId: horaElegida.bloqueId,
        fechaDestino: fecha,
      },
      {
        onSuccess: ({ turnoId }) => {
          toast.success('Turno reprogramado')
          onCerrar()
          // En un recurrente, la fecha movida es un turno nuevo: el detalle se abre con el id que
          // devuelve la API y la fecha nueva, no con los de la URL actual.
          router.replace(hrefDetalle(turnoId, fecha), { scroll: false })
        },
        onError: (error) => {
          const interpretado = interpretarErrorReprogramacion(error)
          if (interpretado.tipo === 'volverABuscar') {
            volverALaBusqueda(
              `${interpretado.mensaje}. Los horarios cambiaron desde la búsqueda: elegí uno de nuevo.`,
            )
            return
          }
          // Vuelve a la selección: el rechazo se resuelve cambiando la hora o la fecha.
          setConfirmando(false)
          setRechazo(interpretado)
        },
      },
    )
  }

  const actual = `${nombreDiaSemana(diaSemanaDeFecha(ocurrencia.fecha))} ${textoHorario(ocurrencia.horaInicio, ocurrencia.horaFin)}`
  const rechazoVisible =
    rechazo &&
    (rechazo.tipo === 'volverABuscar' ? { ...rechazo, tipo: 'general' as const } : rechazo)

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Reprogramar turno</DialogTitle>
        <DialogDescription>
          {ocurrencia.alumno.nombre} {ocurrencia.alumno.apellido} · {materia.nombre}. Hoy está el{' '}
          {actual} con {ocurrencia.profesor.nombre} {ocurrencia.profesor.apellido}.
        </DialogDescription>
      </DialogHeader>

      {confirmando && cambio ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">Se va a reprogramar el turno:</p>
          <p className="border-border bg-canvas flex items-start gap-2 rounded-lg border p-4 text-sm">
            <ArrowRight className="text-cobalto mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{cambio}</span>
          </p>
          <p className="text-muted-foreground text-sm">
            El turno sigue agendado y conserva su pago. Si es parte de una serie recurrente, solo se
            mueve esta fecha.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {aviso && <AlertaRechazo rechazo={{ tipo: 'general', mensaje: aviso }} />}
          {rechazoVisible && (
            <AlertaRechazo rechazo={rechazoVisible} onBuscarOtros={() => volverALaBusqueda()} />
          )}

          <FiltrosDisponibilidad
            filtros={filtros}
            onCambio={cambiarFiltros}
            materiaFija={materia}
          />

          {bloqueElegido ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">
                    {bloqueElegido.profesor.apellido}, {bloqueElegido.profesor.nombre}
                  </span>
                  <span className="text-muted-foreground">
                    {nombreDiaSemana(bloqueElegido.diaSemana)}{' '}
                    {textoHorario(bloqueElegido.horaInicio, bloqueElegido.horaFin)}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DoorOpen className="size-3.5" aria-hidden />
                    {bloqueElegido.aula.nombre}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => volverALaBusqueda()}
                >
                  <CalendarSearch />
                  Elegir otro horario
                </Button>
              </div>

              <Field label="Fecha nueva" htmlFor="reprogramar-fecha" required>
                {/* Solo deja elegir el día del bloque, desde su próxima ocurrencia. La API valida
                    igual el día y que no sea pasada. */}
                <CalendarioFecha
                  id="reprogramar-fecha"
                  value={fecha}
                  onChange={setFecha}
                  min={bloqueElegido.fecha}
                  diaSemana={bloqueElegido.diaSemana}
                  disabled={reprogramar.isPending}
                />
              </Field>

              {bloqueMostrado && (
                <HorasDelBloque
                  bloque={bloqueMostrado}
                  tildadas={horaElegida ? [horaElegida.bloqueId] : []}
                  onCambio={([id]) => setHoraId(id ?? null)}
                  deshabilitado={reprogramar.isPending}
                  actualizando={fechaRefresco !== undefined && refresco.isFetching}
                  avisos={
                    horaDelBloque && horaLlena
                      ? [avisoHoraCompleta(horaDelBloque, bloqueMostrado.fecha)]
                      : []
                  }
                  unaSola
                />
              )}
            </div>
          ) : (
            <ResultadosDisponibilidad
              resultados={disponibilidad.data}
              isLoading={disponibilidad.isLoading}
              isPlaceholderData={disponibilidad.isPlaceholderData}
              error={disponibilidad.error}
              onReintentar={() => void disponibilidad.refetch()}
              claveElegida={claveElegida}
              onElegir={elegirBloque}
              hayFiltrosOpcionales={filtros.diaSemana !== null || filtros.profesorId !== null}
            />
          )}
        </div>
      )}

      <DialogFooter>
        {confirmando ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmando(false)}
              disabled={reprogramar.isPending}
            >
              Volver
            </Button>
            <Button type="button" onClick={confirmar} disabled={reprogramar.isPending}>
              {reprogramar.isPending ? 'Reprogramando…' : 'Confirmar'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setRechazo(null)
                setConfirmando(true)
              }}
              disabled={!puedeContinuar}
            >
              Continuar
            </Button>
          </>
        )}
      </DialogFooter>
    </div>
  )
}
