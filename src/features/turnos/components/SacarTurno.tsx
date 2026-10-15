'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, AlertTriangle, DoorOpen, Pencil, Wallet } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { type ErrorAltaTurno, interpretarErrorAlta } from '../errores-turnos'
import { textoHorario } from '../formato-turnos'
import { useInvalidarMiDisponibilidad } from '../hooks/use-invalidar-mi-disponibilidad'
import { useMiDisponibilidad } from '../hooks/use-mi-disponibilidad'
import { useMiHabilitacion } from '../hooks/use-mi-habilitacion'
import { useMisMaterias } from '../hooks/use-mis-materias'
import { useSacarTurno } from '../hooks/use-sacar-turno'
import type { BloqueOfertado, MiTurnoCrear, MiTurnoReservado } from '../mis-turnos.types'
import {
  type SacarTurnoFormValues,
  armarMiTurnoCrear,
  claveBloqueOfertado,
  sacarTurnoFormInicial,
  sacarTurnoFormSchema,
} from '../sacar-turno'
import {
  FiltrosMiBusqueda,
  MIS_FILTROS_VACIOS,
  type MisFiltros,
  MisHorasDelBloque,
  MisResultadosDisponibilidad,
} from './SacarTurnoBusqueda'
import { MiTurnoForm } from './SacarTurnoDatos'
import { SacarTurnoReservado } from './SacarTurnoReservado'
import { AlertaRechazoPortal, type RechazoResumen, ResumenTurno } from './SacarTurnoResumen'
import { SeccionPaso } from './SeccionPaso'

/** El aviso al entrar con deuda vencida (HU-29). La habilitación no trae texto: es el de la HU. */
const MENSAJE_DEUDA =
  'Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada'

type SacarTurnoProps = {
  /** "Mis pagos" del portal (`/portal/pagos`): el acceso del aviso de deuda vencida. */
  hrefMisPagos: string
  /** "Mi calendario" del portal (`/portal/calendario`): el acceso de "Turno reservado". */
  hrefMiCalendario: string
}

/** Con deuda vencida, sólo el aviso con el acceso a "Mis pagos". */
function AvisoDeuda({ mensaje, hrefMisPagos }: { mensaje: string; hrefMisPagos: string }) {
  return (
    <Card className="gap-4">
      <Alert>
        <AlertTriangle className="text-urgente size-4" />
        <AlertDescription className="text-foreground">{mensaje}</AlertDescription>
      </Alert>
      <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
        <Link href={hrefMisPagos}>
          <Wallet />
          Ver Mis pagos
        </Link>
      </Button>
    </Card>
  )
}

/** Resumen compacto del horario elegido (profesor, día, horario y aula). */
function ResumenBloque({ bloque }: { bloque: BloqueOfertado }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">
        {bloque.profesor.nombre} {bloque.profesor.apellido}
      </span>
      <span className="text-muted-foreground">
        {nombreDiaSemana(bloque.diaSemana)} {textoHorario(bloque.horaInicio, bloque.horaFin)}
      </span>
      <span className="text-muted-foreground flex items-center gap-1">
        <DoorOpen className="size-3.5" aria-hidden />
        {bloque.aula.nombre}
      </span>
    </p>
  )
}

/**
 * "Sacar turno" desde el portal del alumno (HU-29). Al entrar consulta la habilitación: con deuda
 * vencida sólo muestra el aviso. Si no, el mismo recorrido que el alta de la mesa (HU-07) en una
 * sola pantalla con secciones que se habilitan en orden (horario → horas → tipo, fechas y temas),
 * sin elegir alumno (es el de la sesión) y sin observaciones (son internas de la mesa). No calcula
 * reglas: las materias, si una hora está disponible, las fechas válidas, la superposición, las
 * fechas completas y la deuda los decide la API, y sus rechazos se interpretan en
 * `errores-turnos.ts` (los mismos códigos que el alta de la mesa).
 */
export function SacarTurno({ hrefMisPagos, hrefMiCalendario }: SacarTurnoProps) {
  const toast = useToast()
  const habilitacion = useMiHabilitacion()
  const habilitado = habilitacion.data?.habilitado === true
  const sacar = useSacarTurno()
  const invalidarDisponibilidad = useInvalidarMiDisponibilidad()
  const seccionBusqueda = useRef<HTMLDivElement>(null)

  // --- 1. Búsqueda.
  const [filtros, setFiltros] = useState<MisFiltros>(MIS_FILTROS_VACIOS)
  const [claveElegida, setClaveElegida] = useState<string | null>(null)
  const [avisoBusqueda, setAvisoBusqueda] = useState<string | null>(null)

  const materias = useMisMaterias(habilitado)
  // Sin filtrar: de acá salen el profesor y el día que ofrece la búsqueda.
  const horariosMateria = useMiDisponibilidad(
    { materiaId: filtros.materiaId ?? undefined },
    habilitado,
  )
  const horarios = useMiDisponibilidad(
    {
      materiaId: filtros.materiaId ?? undefined,
      profesorId: filtros.profesorId ?? undefined,
      diaSemana: filtros.diaSemana ?? undefined,
    },
    habilitado,
  )
  const bloqueElegido =
    claveElegida !== null && horarios.data
      ? (horarios.data.find((b) => claveBloqueOfertado(b) === claveElegida) ?? null)
      : null

  // --- 2. Horas.
  const [tildadas, setTildadas] = useState<number[]>([])
  const [errorHoras, setErrorHoras] = useState<string | null>(null)

  // --- 3. Formulario.
  const form = useForm<SacarTurnoFormValues>({
    resolver: zodResolver(sacarTurnoFormSchema),
    defaultValues: sacarTurnoFormInicial('SESION_UNICA'),
  })
  const valores = useWatch({ control: form.control }) as SacarTurnoFormValues

  // --- Alta y rechazos.
  const [rechazo, setRechazo] = useState<RechazoResumen | null>(null)
  /** El `message` de un 409 `DEUDA_VENCIDA` al confirmar (la deuda cambió desde que entró). */
  const [deudaAlConfirmar, setDeudaAlConfirmar] = useState<string | null>(null)
  const [ultimoPedido, setUltimoPedido] = useState<MiTurnoCrear | null>(null)
  const [reservado, setReservado] = useState<MiTurnoReservado | null>(null)

  // --- Limpiezas en cascada.
  const limpiarHoras = () => {
    setTildadas([])
    setErrorHoras(null)
    setRechazo(null)
  }
  const limpiarBloque = () => {
    setClaveElegida(null)
    limpiarHoras()
  }

  /** Vuelve a la búsqueda con los filtros, sin horario ni horas, y la refresca. */
  const volverALaBusqueda = (aviso: string | null = null) => {
    limpiarBloque()
    setAvisoBusqueda(aviso)
    void invalidarDisponibilidad()
    seccionBusqueda.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cambiarFiltros = (nuevos: MisFiltros) => {
    setFiltros(nuevos)
    setAvisoBusqueda(null)
    limpiarBloque()
  }

  const elegirBloque = (bloque: BloqueOfertado) => {
    setClaveElegida(claveBloqueOfertado(bloque))
    setAvisoBusqueda(null)
    limpiarHoras()
    // La fecha propuesta es la del resultado: la próxima clase de ese horario, desde mañana.
    const { tipo, temas = '' } = form.getValues()
    form.reset(sacarTurnoFormInicial(tipo, bloque.fecha, temas))
  }

  const reiniciar = () => {
    setFiltros(MIS_FILTROS_VACIOS)
    setAvisoBusqueda(null)
    limpiarBloque()
    setUltimoPedido(null)
    setReservado(null)
    sacar.reset()
    form.reset(sacarTurnoFormInicial('SESION_UNICA'))
  }

  const manejarRechazo = (resultado: ErrorAltaTurno) => {
    switch (resultado.tipo) {
      case 'campos': {
        for (const { campo, mensaje } of resultado.camposMarcados) {
          if (campo === 'bloqueIds') setErrorHoras(mensaje)
          else if (campo !== 'observaciones') form.setError(campo, { message: mensaje })
        }
        const primero = resultado.camposMarcados.find(
          (c) => c.campo !== 'bloqueIds' && c.campo !== 'observaciones',
        )
        if (primero && primero.campo !== 'bloqueIds' && primero.campo !== 'observaciones') {
          form.setFocus(primero.campo)
        }
        setRechazo(resultado.mensaje ? { tipo: 'general', mensaje: resultado.mensaje } : null)
        return
      }
      case 'volverABuscar':
        volverALaBusqueda(`${resultado.mensaje}. Los horarios cambiaron: elegí uno de nuevo.`)
        return
      case 'deudaVencida':
        setDeudaAlConfirmar(resultado.mensaje)
        return
      case 'fechasLlenas':
      case 'sinLugar':
      case 'alumnoSuperpuesto':
      case 'general':
        setRechazo(resultado)
        return
    }
  }

  const enviar = (pedido: MiTurnoCrear) => {
    setUltimoPedido(pedido)
    setRechazo(null)
    sacar.mutate(pedido, {
      onSuccess: (respuesta) => {
        setReservado(respuesta)
        toast.success('Turno reservado')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
      onError: (error) => manejarRechazo(interpretarErrorAlta(error, pedido.tipo)),
    })
  }

  const confirmar = (datos: SacarTurnoFormValues) => {
    if (!bloqueElegido || filtros.materiaId === null) return
    setRechazo(null)
    setErrorHoras(null)
    const horas = bloqueElegido.horas.filter((hora) => tildadas.includes(hora.bloqueId))
    enviar(armarMiTurnoCrear({ materiaId: filtros.materiaId, horas }, datos, false))
  }

  // --- Habilitación (antes de todo).
  if (habilitacion.isLoading) {
    return (
      <Card aria-busy className="gap-4">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </Card>
    )
  }
  if (habilitacion.error || !habilitacion.data) {
    const sinPermiso = habilitacion.error?.status === 403
    return (
      <Card>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-destructive space-y-3">
            <p>
              {sinPermiso
                ? 'No tenés permiso para sacar turnos.'
                : 'No pudimos comprobar si podés sacar un turno.'}
            </p>
            {!sinPermiso && (
              <Button variant="outline" size="sm" onClick={() => void habilitacion.refetch()}>
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </Card>
    )
  }
  if (deudaAlConfirmar !== null || !habilitado) {
    return <AvisoDeuda mensaje={deudaAlConfirmar ?? MENSAJE_DEUDA} hrefMisPagos={hrefMisPagos} />
  }

  if (reservado) {
    return (
      <SacarTurnoReservado
        reservado={reservado}
        hrefMiCalendario={hrefMiCalendario}
        onSacarOtro={reiniciar}
      />
    )
  }

  const materia = materias.data?.find((m) => m.id === filtros.materiaId) ?? null
  const hayFiltrosOpcionales = filtros.profesorId !== null || filtros.diaSemana !== null
  const horasElegidas = bloqueElegido?.horas.filter((h) => tildadas.includes(h.bloqueId)) ?? []

  return (
    <div className="space-y-6">
      <div ref={seccionBusqueda} className="scroll-mt-6">
        <SeccionPaso
          numero={1}
          titulo="Elegí el horario"
          descripcion={!bloqueElegido && 'Elegí la materia y, si querés, el profesor y el día.'}
          accion={
            bloqueElegido && (
              <Button
                variant="outline"
                size="sm"
                onClick={limpiarBloque}
                aria-label="Cambiar horario"
              >
                <Pencil />
                Cambiar
              </Button>
            )
          }
        >
          {bloqueElegido ? (
            <ResumenBloque bloque={bloqueElegido} />
          ) : (
            <div className="space-y-5">
              {avisoBusqueda && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-destructive">{avisoBusqueda}</AlertDescription>
                </Alert>
              )}
              <FiltrosMiBusqueda
                materias={materias}
                horariosMateria={horariosMateria}
                filtros={filtros}
                onCambio={cambiarFiltros}
              />
              {filtros.materiaId === null ? (
                <p className="text-muted-foreground text-sm">
                  Elegí una materia para ver los horarios.
                </p>
              ) : (
                <MisResultadosDisponibilidad
                  horarios={horarios}
                  claveElegida={claveElegida}
                  onElegir={elegirBloque}
                  hayFiltrosOpcionales={hayFiltrosOpcionales}
                />
              )}
            </div>
          )}
        </SeccionPaso>
      </div>

      <SeccionPaso
        numero={2}
        titulo="Horas"
        descripcion="Elegí una o más horas. Las completas no se pueden elegir."
        bloqueada={!bloqueElegido}
        textoBloqueada="Primero elegí un horario."
      >
        {bloqueElegido && (
          <MisHorasDelBloque
            bloque={bloqueElegido}
            tildadas={tildadas}
            onCambio={(nuevas) => {
              setTildadas(nuevas)
              setErrorHoras(null)
            }}
            deshabilitado={sacar.isPending}
            error={errorHoras ?? undefined}
          />
        )}
      </SeccionPaso>

      <SeccionPaso
        numero={3}
        titulo="Cuándo y qué querés trabajar"
        bloqueada={!bloqueElegido}
        textoBloqueada="Primero elegí un horario."
      >
        {bloqueElegido && (
          <MiTurnoForm
            form={form}
            diaSemana={bloqueElegido.diaSemana}
            fechaMinima={bloqueElegido.fecha}
            onSubmit={confirmar}
            isPending={sacar.isPending}
            sinHoras={tildadas.length === 0}
            resumen={
              materia &&
              horasElegidas.length > 0 && (
                <ResumenTurno
                  materia={materia.nombre}
                  bloque={bloqueElegido}
                  bloqueIds={tildadas}
                  pedido={armarMiTurnoCrear(
                    { materiaId: materia.id, horas: horasElegidas },
                    valores,
                    false,
                  )}
                />
              )
            }
            rechazo={
              rechazo && (
                <AlertaRechazoPortal
                  rechazo={rechazo}
                  isPending={sacar.isPending}
                  onReservarConLugar={() => {
                    if (ultimoPedido) enviar({ ...ultimoPedido, asignarDondeHayLugar: true })
                  }}
                  onElegirOtroHorario={() => volverALaBusqueda()}
                />
              )
            }
          />
        )}
      </SeccionPaso>
    </div>
  )
}
