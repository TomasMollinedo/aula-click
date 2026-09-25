'use client'

import { useCallback, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { DoorOpen, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAlumno } from '@/features/alumnos/hooks/use-alumno'
import { useToast } from '@/hooks/use-toast'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { type ErrorAltaTurno, interpretarErrorAlta } from '../errores-turnos'
import { avisoHoraCompleta, textoHorario } from '../formato-turnos'
import { useCrearTurnos } from '../hooks/use-crear-turnos'
import { useDisponibilidad } from '../hooks/use-disponibilidad'
import { useInvalidarDisponibilidad } from '../hooks/use-invalidar-disponibilidad'
import { buscarBloque, claveBloque, tildadasLlenas } from '../seleccion-turno'
import {
  TURNO_FORM_VACIO,
  type TurnoFormValues,
  armarTurnoCrear,
  esFechaConFormato,
  turnoFormSchema,
} from '../turnos.schema'
import type { AlumnoElegido, BloqueDisponible, TurnoCrear, TurnosAlta } from '../turnos.types'
import { ConfirmacionTurno } from './ConfirmacionTurno'
import {
  FILTROS_VACIOS,
  type FiltrosBusqueda,
  FiltrosDisponibilidad,
} from './FiltrosDisponibilidad'
import { HorasDelBloque } from './HorasDelBloque'
import { AlertaRechazo, DialogoFechasLlenas } from './RechazoAlta'
import { ResultadosDisponibilidad } from './ResultadosDisponibilidad'
import { SeccionPaso } from './SeccionPaso'
import { ResumenAlumno, SeleccionAlumno } from './SeleccionAlumno'
import { TurnoDetalleModal } from './TurnoDetalleModal'
import { TurnoForm } from './TurnoForm'

type RegistrarTurnoProps = {
  /** URL de esta pantalla en el segmento del rol (por ejemplo `/mesa/turnos`). */
  rutaBase: string
  /** URL del alta de alumno que vuelve acá con `?alumnoId=` (la arma la página). */
  hrefAltaAlumno: string
}

/** Id de la URL (`?alumnoId=`, `?detalle=`) como número, o `null` si no es un entero positivo. */
function parsearId(valor: string | null): number | null {
  const id = Number(valor)
  return valor !== null && Number.isInteger(id) && id > 0 ? id : null
}

function mensajeErrorAlumno(status: number, message: string): string {
  if (status === 404) return 'No encontramos ese alumno. Buscalo de nuevo.'
  if (status === 403) return 'No tenés permiso para ver alumnos.'
  return message
}

/** Resumen compacto del bloque elegido (profesor, día, horario y aula). */
function ResumenBloque({ bloque }: { bloque: BloqueDisponible }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">
        {bloque.profesor.apellido}, {bloque.profesor.nombre}
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
 * Pantalla de registrar turno (HU-07): una sola pantalla con secciones que se habilitan en orden
 * (alumno → horario → horas → tipo, fechas y motivo). Cambiar algo de arriba limpia lo de abajo que
 * depende de eso. No calcula reglas: la ocupación, `lleno`, las fechas y los rechazos vienen de la
 * API; los errores se interpretan en `errores-turnos.ts`.
 */
export function RegistrarTurno({ rutaBase, hrefAltaAlumno }: RegistrarTurnoProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const invalidarDisponibilidad = useInvalidarDisponibilidad()
  const crear = useCrearTurnos()
  const pasoBusqueda = useRef<HTMLDivElement>(null)

  // --- 1. Alumno: el del buscador o, de vuelta del alta (`?alumnoId=`), el de la URL.
  const alumnoIdUrl = parsearId(searchParams.get('alumnoId'))
  const alumnoUrl = useAlumno(alumnoIdUrl ?? 0)
  // `undefined`: todavía no se eligió ni se cambió en la pantalla, vale el de la URL.
  const [alumnoElegido, setAlumnoElegido] = useState<AlumnoElegido | null | undefined>(undefined)
  const alumnoDeUrl: AlumnoElegido | null = alumnoUrl.data
    ? {
        id: alumnoUrl.data.id,
        nombre: alumnoUrl.data.nombre,
        apellido: alumnoUrl.data.apellido,
        dni: alumnoUrl.data.dni,
      }
    : null
  const alumno = alumnoElegido === undefined ? alumnoDeUrl : alumnoElegido
  const precargandoAlumno =
    alumnoElegido === undefined && alumnoIdUrl !== null && alumnoUrl.isLoading
  const avisoAlumno =
    alumnoElegido === undefined && alumnoUrl.error
      ? mensajeErrorAlumno(alumnoUrl.error.status, alumnoUrl.error.message)
      : null

  // --- 2. Búsqueda.
  const [filtros, setFiltros] = useState<FiltrosBusqueda>(FILTROS_VACIOS)
  const [claveElegida, setClaveElegida] = useState<string | null>(null)
  const [avisoBusqueda, setAvisoBusqueda] = useState<string | null>(null)
  const disponibilidad = useDisponibilidad({
    materiaId: filtros.materiaId ?? undefined,
    diaSemana: filtros.diaSemana ?? undefined,
    profesorId: filtros.profesorId ?? undefined,
  })
  // Con la lista de los filtros anteriores (placeholder) no hay bloque elegido.
  const bloqueElegido =
    claveElegida !== null && !disponibilidad.isPlaceholderData
      ? buscarBloque(disponibilidad.data, claveElegida)
      : null

  // --- 3. Horas.
  const [tildadas, setTildadas] = useState<number[]>([])
  const [avisosHoras, setAvisosHoras] = useState<string[]>([])
  const [errorHoras, setErrorHoras] = useState<string | null>(null)

  // --- 4. Formulario.
  const form = useForm<TurnoFormValues>({
    resolver: zodResolver(turnoFormSchema),
    defaultValues: TURNO_FORM_VACIO.RECURRENTE,
  })
  const valoresFecha = useWatch({ control: form.control }) as Partial<{
    tipo: TurnoFormValues['tipo']
    fecha: string
    fechaInicio: string
  }>
  const fechaElegida =
    valoresFecha.tipo === 'SESION_UNICA' ? valoresFecha.fecha : valoresFecha.fechaInicio

  // --- Refresco de la ocupación con la fecha elegida (§7): misma materia y profesor, sin
  // `diaSemana` (la API da 400 si no coincide con la fecha). Es un refresco de lo que se ve: la
  // capacidad por fecha la decide el alta.
  const fechaRefresco =
    bloqueElegido && esFechaConFormato(fechaElegida) && fechaElegida !== bloqueElegido.fecha
      ? fechaElegida
      : undefined
  const refresco = useDisponibilidad(
    {
      materiaId: filtros.materiaId ?? undefined,
      profesorId: bloqueElegido?.profesor.id,
      fecha: fechaRefresco,
    },
    fechaRefresco !== undefined,
  )
  // Solo la respuesta de la fecha actual (no el placeholder de la anterior) y el mismo bloque (las
  // mismas horas). Sin match o con error (400: la fecha no cae en ese día, o es pasada) no hay nada.
  const matchRefresco =
    fechaRefresco !== undefined &&
    claveElegida !== null &&
    !refresco.isPlaceholderData &&
    !refresco.isError
      ? buscarBloque(refresco.data, claveElegida)
      : null
  // Lo último que se mostró con otra fecha (sin match o con error se mantiene). Con la fecha del
  // resultado, vale el resultado. Se ajusta durante el render cuando cambia la respuesta, con el
  // patrón de React para estado que depende de un valor anterior (sin efectos).
  const [refrescado, setRefrescado] = useState<BloqueDisponible | null>(null)
  const [matchAnterior, setMatchAnterior] = useState<BloqueDisponible | null>(null)
  const fechaDelResultado = bloqueElegido !== null && fechaElegida === bloqueElegido.fecha
  if (fechaDelResultado && refrescado !== null) setRefrescado(null)
  if (matchRefresco !== matchAnterior) {
    setMatchAnterior(matchRefresco)
    if (matchRefresco) {
      setRefrescado(matchRefresco)
      // Una hora tildada que en esa fecha viene `lleno` (lo dice la API) se destilda y se avisa.
      const llenas = tildadasLlenas(matchRefresco, tildadas)
      if (llenas.length > 0) {
        setTildadas(tildadas.filter((id) => !llenas.some((hora) => hora.bloqueId === id)))
        setAvisosHoras(llenas.map((hora) => avisoHoraCompleta(hora, matchRefresco.fecha)))
      }
    }
  }

  const bloqueMostrado = bloqueElegido ? (refrescado ?? bloqueElegido) : null

  // --- Alta y rechazos.
  const [rechazo, setRechazo] = useState<ErrorAltaTurno | null>(null)
  const [ultimoPedido, setUltimoPedido] = useState<TurnoCrear | null>(null)
  const [resultado, setResultado] = useState<{ alta: TurnosAlta; pedido: TurnoCrear } | null>(null)

  // --- Detalle de un turno: modal con `?detalle=<id>` (T-34), sin ruta propia.
  const detalleId = parsearId(searchParams.get('detalle'))
  const detalleAbiertoConLink = useRef(false)
  const hrefDetalle = useCallback(
    (turnoId: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('detalle', String(turnoId))
      return `${rutaBase}?${params}`
    },
    [searchParams, rutaBase],
  )
  const cerrarDetalle = () => {
    if (detalleAbiertoConLink.current) {
      detalleAbiertoConLink.current = false
      router.back()
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete('detalle')
    const qs = params.toString()
    router.replace(qs ? `${rutaBase}?${qs}` : rutaBase, { scroll: false })
  }

  // --- Limpiezas en cascada.
  const limpiarHoras = () => {
    setTildadas([])
    setAvisosHoras([])
    setErrorHoras(null)
    setRefrescado(null)
    setRechazo(null)
  }
  const limpiarBloque = () => {
    setClaveElegida(null)
    limpiarHoras()
  }

  /** Vuelve a la búsqueda con el alumno y los filtros, sin bloque ni horas, y la refresca. */
  const volverALaBusqueda = (aviso: string | null = null) => {
    limpiarBloque()
    setAvisoBusqueda(aviso)
    void invalidarDisponibilidad()
    pasoBusqueda.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const elegirAlumno = (nuevo: AlumnoElegido | null) => {
    setAlumnoElegido(nuevo)
    setRechazo(null)
    if (nuevo === null && alumnoIdUrl !== null) router.replace(rutaBase, { scroll: false })
  }

  const cambiarFiltros = (nuevos: FiltrosBusqueda) => {
    setFiltros(nuevos)
    setAvisoBusqueda(null)
    limpiarBloque()
  }

  const elegirBloque = (bloque: BloqueDisponible) => {
    setClaveElegida(claveBloque(bloque))
    setAvisoBusqueda(null)
    limpiarHoras()
    // La fecha propuesta es la del resultado: la próxima ocurrencia que devolvió la API.
    const { tipo, motivoConsulta = '' } = form.getValues()
    form.reset(
      tipo === 'SESION_UNICA'
        ? { tipo, fecha: bloque.fecha, motivoConsulta }
        : { tipo, fechaInicio: bloque.fecha, fechaFin: '', motivoConsulta },
    )
  }

  const cambiarTildadas = (nuevas: number[]) => {
    setTildadas(nuevas)
    setErrorHoras(null)
    setAvisosHoras([])
  }

  const reiniciar = (conservarAlumno: boolean) => {
    setAlumnoElegido(conservarAlumno ? alumno : null)
    setFiltros(FILTROS_VACIOS)
    setAvisoBusqueda(null)
    limpiarBloque()
    setUltimoPedido(null)
    setResultado(null)
    crear.reset()
    form.reset(TURNO_FORM_VACIO.RECURRENTE)
    if (!conservarAlumno) router.replace(rutaBase, { scroll: false })
  }

  const manejarRechazo = (resultadoError: ErrorAltaTurno) => {
    switch (resultadoError.tipo) {
      case 'campos': {
        for (const { campo, mensaje } of resultadoError.camposMarcados) {
          if (campo === 'bloqueIds') setErrorHoras(mensaje)
          else form.setError(campo, { message: mensaje })
        }
        const primero = resultadoError.camposMarcados.find((c) => c.campo !== 'bloqueIds')
        if (primero && primero.campo !== 'bloqueIds') form.setFocus(primero.campo)
        setRechazo(
          resultadoError.mensaje ? { tipo: 'general', mensaje: resultadoError.mensaje } : null,
        )
        return
      }
      case 'volverABuscar':
        volverALaBusqueda(
          `${resultadoError.mensaje}. Los horarios cambiaron desde la búsqueda: elegí uno de nuevo.`,
        )
        return
      case 'fechasLlenas':
      case 'sinLugar':
      case 'alumnoSuperpuesto':
      case 'general':
        setRechazo(resultadoError)
        return
    }
  }

  const enviar = (pedido: TurnoCrear) => {
    setUltimoPedido(pedido)
    crear.mutate(pedido, {
      onSuccess: (alta) => {
        setRechazo(null)
        setResultado({ alta, pedido })
        const [primero] = alta.turnos
        toast.success(
          primero
            ? `Se agendó el turno de ${primero.alumno.nombre} ${primero.alumno.apellido}`
            : 'Se agendó el turno',
        )
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
      onError: (error) => manejarRechazo(interpretarErrorAlta(error, pedido.tipo)),
    })
  }

  const registrar = (valores: TurnoFormValues) => {
    if (!alumno || !bloqueMostrado || filtros.materiaId === null) return
    setRechazo(null)
    setErrorHoras(null)
    const horas = bloqueMostrado.horas.filter((hora) => tildadas.includes(hora.bloqueId))
    enviar(
      armarTurnoCrear({ alumnoId: alumno.id, materiaId: filtros.materiaId, horas }, valores, false),
    )
  }

  const detalle = detalleId !== null && (
    <TurnoDetalleModal turnoId={detalleId} onCerrar={cerrarDetalle} />
  )

  if (resultado) {
    return (
      <>
        <ConfirmacionTurno
          alta={resultado.alta}
          pedido={resultado.pedido}
          hrefDetalle={hrefDetalle}
          onVerDetalle={() => {
            detalleAbiertoConLink.current = true
          }}
          onRegistrarOtro={() => reiniciar(false)}
          onRegistrarOtroMismoAlumno={() => reiniciar(true)}
        />
        {detalle}
      </>
    )
  }

  // Las secciones se habilitan en orden: sin alumno, tampoco las horas ni el formulario.
  const pasoHorasHabilitado = alumno !== null && bloqueMostrado !== null
  const hayFiltrosOpcionales = filtros.diaSemana !== null || filtros.profesorId !== null
  const cambiar = (onClick: () => void, etiqueta: string) => (
    <Button variant="outline" size="sm" onClick={onClick} aria-label={etiqueta}>
      <Pencil />
      Cambiar
    </Button>
  )

  return (
    <div className="space-y-6">
      <SeccionPaso
        numero={1}
        titulo="Alumno"
        accion={alumno && cambiar(() => elegirAlumno(null), 'Cambiar alumno')}
      >
        {alumno ? (
          <ResumenAlumno alumno={alumno} />
        ) : precargandoAlumno ? (
          <Skeleton className="h-6 w-64" />
        ) : (
          <SeleccionAlumno
            hrefAltaAlumno={hrefAltaAlumno}
            onElegir={elegirAlumno}
            aviso={avisoAlumno}
          />
        )}
      </SeccionPaso>

      <div ref={pasoBusqueda} className="scroll-mt-6">
        <SeccionPaso
          numero={2}
          titulo="Buscar horario"
          descripcion={!bloqueElegido && 'Elegí la materia y, si querés, el día y el profesor.'}
          bloqueada={!alumno}
          textoBloqueada="Primero elegí un alumno."
          accion={bloqueElegido && cambiar(limpiarBloque, 'Cambiar horario')}
        >
          {bloqueElegido ? (
            <ResumenBloque bloque={bloqueElegido} />
          ) : (
            <div className="space-y-5">
              {avisoBusqueda && (
                <AlertaRechazo rechazo={{ tipo: 'general', mensaje: avisoBusqueda }} />
              )}
              <FiltrosDisponibilidad filtros={filtros} onCambio={cambiarFiltros} />
              {filtros.materiaId === null ? (
                <p className="text-muted-foreground text-sm">
                  Elegí una materia para ver los horarios.
                </p>
              ) : (
                <ResultadosDisponibilidad
                  resultados={disponibilidad.data}
                  isLoading={disponibilidad.isLoading}
                  isPlaceholderData={disponibilidad.isPlaceholderData}
                  error={disponibilidad.error}
                  onReintentar={() => void disponibilidad.refetch()}
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
        numero={3}
        titulo="Horas"
        descripcion="Tildá una o más horas. Las completas no se pueden elegir."
        bloqueada={!pasoHorasHabilitado}
        textoBloqueada={alumno ? 'Elegí un horario de la búsqueda.' : 'Primero elegí un alumno.'}
      >
        {pasoHorasHabilitado && bloqueMostrado && (
          <HorasDelBloque
            bloque={bloqueMostrado}
            tildadas={tildadas}
            onCambio={cambiarTildadas}
            deshabilitado={crear.isPending}
            actualizando={fechaRefresco !== undefined && refresco.isFetching}
            avisos={avisosHoras}
            error={errorHoras ?? undefined}
          />
        )}
      </SeccionPaso>

      <SeccionPaso
        numero={4}
        titulo="Tipo, fechas y motivo"
        bloqueada={!pasoHorasHabilitado}
        textoBloqueada={alumno ? 'Elegí un horario de la búsqueda.' : 'Primero elegí un alumno.'}
      >
        {pasoHorasHabilitado && bloqueMostrado && (
          <TurnoForm
            form={form}
            diaSemana={bloqueMostrado.diaSemana}
            onSubmit={registrar}
            isPending={crear.isPending}
            sinHoras={tildadas.length === 0}
            rechazo={
              rechazo &&
              rechazo.tipo !== 'fechasLlenas' &&
              rechazo.tipo !== 'campos' &&
              rechazo.tipo !== 'volverABuscar' && (
                <AlertaRechazo rechazo={rechazo} onBuscarOtros={() => volverALaBusqueda()} />
              )
            }
          />
        )}
      </SeccionPaso>

      <DialogoFechasLlenas
        rechazo={rechazo?.tipo === 'fechasLlenas' ? rechazo : null}
        isPending={crear.isPending}
        onAsignarIgual={() => {
          if (ultimoPedido) enviar({ ...ultimoPedido, asignarDondeHayLugar: true })
        }}
        onCancelar={() => volverALaBusqueda()}
      />

      {detalle}
    </div>
  )
}
