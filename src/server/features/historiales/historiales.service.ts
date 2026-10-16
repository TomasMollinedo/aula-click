import { ForbiddenError, NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import { alumnoDeLaSesion, type Actor } from '@/server/shared/actor'
import { hoy, sumarDias, type Reloj } from '@/server/shared/fechas'
import { mesDe } from '@/server/shared/zod'
import {
  canceladosDeLosGrupos,
  mesDelPeriodo,
  type FiltrosDelDocumento,
  type HistorialDocumento,
} from './historiales.documentos'
import type { HistorialesRepository, Ocurrencia } from './historiales.repository'
import {
  HORIZONTE_PROXIMO_TURNO,
  armarGrupos,
  armarMisMaterias,
  bloquesDelPortal,
  mesEnCurso,
  opcionesDeLosGrupos,
  rangoDelMes,
  resumirHoras,
  validarPeriodo,
} from './historiales.reglas'
import type {
  GrupoDelHistorial,
  HistorialDelAlumno,
  HistorialPdfQuery,
  HistorialQuery,
  MiMateria,
  MiMateriaQuery,
  MisMaterias,
} from './historiales.validation'

// Reglas de `historiales` (T-108, HU-31 y HU-33). No conoce HTTP ni Prisma: lanza `AppError` o sus
// subclases. El historial es **sólo lectura y sin tablas propias**: las ocurrencias, su estado, su
// asistencia y su cancelación salen del motor de `turnos` (vía el repository) y la agrupación en
// bloques de horas seguidas, el resumen y los porcentajes son funciones puras de
// `historiales.reglas.ts`.

const MENSAJE_ALUMNO_NO_ENCONTRADO = 'Alumno no encontrado'
const MENSAJE_SIN_ALUMNO = 'El alumno no tiene turnos con usted'
const MENSAJE_MATERIA_NO_CURSADA = 'No cursás esa materia con ese profesor'

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo. Los importa solo como tipo, así el service no
 * carga Prisma ni `@/config/env`.
 */
export function crearHistorialesService({
  repository,
  profesoresRepository,
  alumnosRepository,
  reloj,
}: {
  repository: HistorialesRepository
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario'>
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  reloj?: Reloj
}) {
  /**
   * **La función que arma el historial**, una sola para la ficha (HU-31), el portal (HU-33) y su
   * PDF (T-110): lee las ocurrencias del alumno con el motor, incluidas las canceladas, y las
   * agrupa por materia y profesor en bloques de horas seguidas (`armarGrupos`).
   *
   * `hasta` se **recorta a hoy**: el historial son las clases de hoy o anteriores, y los turnos
   * futuros están en los turnos del alumno (HU-31). Si así queda invertido, el motor no consulta
   * nada y el historial sale vacío.
   */
  async function armarHistorial(
    filtro: {
      alumnoId: number
      desde: string
      hasta: string
      materiaId?: number
      profesorId?: number
    },
    fechaHoy: string,
  ): Promise<GrupoDelHistorial[]> {
    const hasta = filtro.hasta < fechaHoy ? filtro.hasta : fechaHoy
    const ocurrencias = await repository.leerOcurrenciasDelAlumno({ ...filtro, hasta }, reloj)
    return armarGrupos(ocurrencias)
  }

  /**
   * El historial **completo** del alumno: desde la fecha del primer turno que tiene (no una
   * ventana fija) hasta hoy. De ahí salen las opciones de los filtros de la ficha y los porcentajes
   * de "Mis materias". Sin turnos, no hay historial y no se consulta el motor.
   */
  async function historialCompleto(
    alumnoId: number,
    fechaHoy: string,
  ): Promise<GrupoDelHistorial[]> {
    const primera = await repository.buscarFechaDelPrimerTurno(alumnoId)
    if (primera === null) return []
    return armarHistorial({ alumnoId, desde: primera, hasta: fechaHoy }, fechaHoy)
  }

  /**
   * El profesor ve el historial completo de su alumno (también las clases de otras materias y
   * profesores, HU-31), pero sólo si el alumno tiene o tuvo turnos con él: el criterio de "Mis
   * alumnos". Si no, 403. Los demás roles que llegan acá (`MESA_ENTRADAS`) no tienen esta
   * restricción.
   */
  async function verificarProfesor(actor: Actor, alumnoId: number): Promise<void> {
    if (actor.role !== 'PROFESOR') return
    const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
    const conRelacion =
      profesorId !== null && (await repository.profesorTieneAlumno(profesorId, alumnoId))
    if (!conRelacion) throw new ForbiddenError(MENSAJE_SIN_ALUMNO)
  }

  /**
   * Las ocurrencias del alumno de una materia con un profesor, desde su primer turno hasta el
   * horizonte de "Mis materias": **una sola lectura** de la que sale si cursa (o cursó) esa materia
   * con ese profesor, el nombre de las dos y las clases del mes que se está mirando.
   */
  async function leerCursada(
    alumnoId: number,
    materiaId: number,
    profesorId: number,
    fechaHoy: string,
  ): Promise<Ocurrencia[]> {
    const primera = await repository.buscarFechaDelPrimerTurno(alumnoId)
    if (primera === null) return []
    return repository.leerOcurrenciasDelAlumno(
      {
        desde: primera,
        hasta: sumarDias(fechaHoy, HORIZONTE_PROXIMO_TURNO),
        alumnoId,
        materiaId,
        profesorId,
      },
      reloj,
    )
  }

  /**
   * Los filtros con los que se pidió el PDF, con el **nombre** de la materia y del profesor para
   * que la hoja diga qué se está viendo. Los nombres salen del historial **completo** del alumno
   * (las mismas `opciones` de la pantalla), así se encuentran también en un mes sin clases; sin
   * filtros no se consulta nada.
   */
  async function filtrosDelDocumento(
    alumnoId: number,
    query: Pick<HistorialPdfQuery, 'materiaId' | 'profesorId'>,
    fechaHoy: string,
  ): Promise<FiltrosDelDocumento> {
    const materiaId = query.materiaId ?? null
    const profesorId = query.profesorId ?? null
    if (materiaId === null && profesorId === null) {
      return { materiaId, profesorId, materia: null, profesor: null }
    }
    const opciones = opcionesDeLosGrupos(await historialCompleto(alumnoId, fechaHoy))
    const materia = opciones.materias.find((m) => m.id === materiaId)
    const profesor = opciones.profesores.find((p) => p.id === profesorId)
    return {
      materiaId,
      profesorId,
      materia: materia?.nombre ?? null,
      profesor: profesor ? { nombre: profesor.nombre, apellido: profesor.apellido } : null,
    }
  }

  return {
    /**
     * Historial académico de un alumno (HU-31): sus clases del período agrupadas por materia y
     * profesor, cada grupo con su resumen y sus bloques de horas seguidas, de la más reciente a la
     * más antigua.
     *
     * Sin `desde` ni `hasta`, el **mes en curso** (si viene uno solo, el otro extremo es el del mes
     * en curso); el período no puede venir invertido ni superar `MAX_DIAS_HISTORIAL` días (400 en
     * `hasta`). Las clases llegan **hasta hoy**: una de hoy sin asistencia se ve `AGENDADO`
     * (decisión T-148).
     *
     * `opciones` sale del historial **completo** del alumno, no del período filtrado, así los
     * filtros de la pantalla no se quedan sin valores al elegir un mes sin clases.
     *
     * Orden de los errores: período (400), alumno inexistente (404) y recién después el permiso
     * del profesor (403), que es el que necesita consultar la base.
     */
    async obtenerDelAlumno(
      alumnoId: number,
      query: HistorialQuery,
      actor: Actor,
    ): Promise<HistorialDelAlumno> {
      const fechaHoy = hoy(reloj)
      const porDefecto = mesEnCurso(fechaHoy)
      const desde = query.desde ?? porDefecto.desde
      const hasta = query.hasta ?? porDefecto.hasta
      validarPeriodo(desde, hasta)

      const alumno = await alumnosRepository.buscarPorId(alumnoId)
      if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)
      await verificarProfesor(actor, alumnoId)

      const grupos = await armarHistorial(
        { alumnoId, desde, hasta, materiaId: query.materiaId, profesorId: query.profesorId },
        fechaHoy,
      )
      const opciones = opcionesDeLosGrupos(await historialCompleto(alumnoId, fechaHoy))

      return {
        alumno: {
          id: alumno.id,
          nombre: alumno.nombre,
          apellido: alumno.apellido,
          dni: alumno.dni,
        },
        desde,
        hasta,
        grupos,
        opciones,
      }
    },

    /**
     * Portal (HU-33, "Mis materias"): cada materia y profesor en los que el alumno de la sesión
     * tiene o tuvo turnos, con su próximo turno (la primera ocurrencia no cancelada de hoy en
     * adelante, hasta `HORIZONTE_PROXIMO_TURNO` días) y su porcentaje de asistencia sobre **todo**
     * su historial. El alumno sale de la sesión, nunca de un parámetro.
     */
    async misMaterias(actor: Actor): Promise<MisMaterias> {
      const alumnoId = alumnoDeLaSesion(actor)
      const fechaHoy = hoy(reloj)
      const grupos = await historialCompleto(alumnoId, fechaHoy)
      const futuras = await repository.leerOcurrenciasDelAlumno(
        { desde: fechaHoy, hasta: sumarDias(fechaHoy, HORIZONTE_PROXIMO_TURNO), alumnoId },
        reloj,
      )
      return armarMisMaterias(grupos, futuras)
    },

    /**
     * Portal (HU-33): una materia con un profesor, con las "Indicaciones para la próxima clase" (de
     * la última clase realizada con indicaciones, de **cualquier** fecha, también anterior al mes),
     * el resumen del mes y sus clases en bloques de horas seguidas, con la misma forma que la ficha.
     *
     * Por defecto, el mes en curso. Sin la observación interna de la ausencia, sin el motivo de la
     * cancelación y sin las clases "Sin registrar" ni agendadas (decisión T-148). Una materia y un
     * profesor en los que no cursa → 404.
     */
    async miMateria(
      materiaId: number,
      profesorId: number,
      query: MiMateriaQuery,
      actor: Actor,
    ): Promise<MiMateria> {
      const alumnoId = alumnoDeLaSesion(actor)
      const fechaHoy = hoy(reloj)
      const mes = query.mes ?? mesDe(fechaHoy)
      const { desde, hasta } = rangoDelMes(mes)

      const cursada = await leerCursada(alumnoId, materiaId, profesorId, fechaHoy)
      const primera = cursada[0]
      if (!primera) throw new NotFoundError(MENSAJE_MATERIA_NO_CURSADA)

      // Las clases del mes, hasta hoy: las mismas que vería la ficha con ese período y esos
      // filtros, y agrupadas con la misma función (`armarGrupos`).
      const tope = hasta < fechaHoy ? hasta : fechaHoy
      const delMes = cursada.filter((o) => o.fecha >= desde && o.fecha <= tope)
      const [grupo] = armarGrupos(delMes)

      const indicaciones = await repository.buscarUltimasIndicaciones({
        alumnoId,
        materiaId,
        antesDe: sumarDias(fechaHoy, 1),
      })

      return {
        materia: { id: primera.materia.id, nombre: primera.materia.nombre },
        profesor: {
          id: primera.profesor.id,
          nombre: primera.profesor.nombre,
          apellido: primera.profesor.apellido,
        },
        mes,
        indicacionesProximaClase: indicaciones && {
          fecha: indicaciones.fecha,
          indicaciones: indicaciones.indicaciones,
        },
        // El único grupo posible (la lectura ya filtra por materia y profesor): su resumen es el
        // de las horas del mes.
        resumen: resumirHoras(delMes),
        bloques: bloquesDelPortal(grupo?.bloques ?? []),
      }
    },

    /**
     * Lo que va en el PDF del historial académico (HU-32, T-110): el alumno con su nivel de
     * escolaridad, el período y los filtros, los grupos del historial, los turnos cancelados del
     * período y sus exámenes.
     *
     * **El período es el que se ve en la pantalla** (decisión T-163): un `mes` o un rango
     * `desde`/`hasta`; si vienen los dos manda el rango, el extremo que falte lo completa el mes (o
     * el mes en curso) y se valida igual que el JSON (`validarPeriodo`: en orden y hasta
     * `MAX_DIAS_HISTORIAL` días, 400 en `hasta`). `mes` queda en el documento sólo si el período es
     * un mes completo: de eso dependen el nombre del archivo y el rótulo del campo.
     *
     * Reusa `armarHistorial`, la misma función que la ficha y el portal: los grupos, su resumen y
     * sus bloques de horas seguidas salen idénticos a los de la pantalla. Los cancelados salen de
     * esos mismos grupos (`canceladosDeLosGrupos`), no de una segunda lectura del motor.
     *
     * Mismo orden de errores y mismas reglas de acceso que `obtenerDelAlumno`: período (400),
     * alumno inexistente (404) y el permiso del profesor (403), que sólo puede sacar el documento
     * de un alumno que tiene o tuvo turnos con él (decisión T-163).
     *
     * El filtro de materia también se aplica a los exámenes (`materiaIds`); el de profesor no, porque
     * un examen es del alumno y de la materia, no de un profesor. Sin observaciones internas.
     */
    async historialParaDocumento(
      alumnoId: number,
      query: HistorialPdfQuery,
      actor: Actor,
    ): Promise<HistorialDocumento> {
      const fechaHoy = hoy(reloj)
      // El mes pedido (o el en curso) es la base: completa el extremo que no venga en el rango.
      const base = rangoDelMes(query.mes ?? mesDe(fechaHoy))
      const desde = query.desde ?? base.desde
      const hasta = query.hasta ?? base.hasta
      validarPeriodo(desde, hasta)

      const alumno = await alumnosRepository.buscarPorId(alumnoId)
      if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)
      await verificarProfesor(actor, alumnoId)

      const grupos = await armarHistorial(
        { alumnoId, desde, hasta, materiaId: query.materiaId, profesorId: query.profesorId },
        fechaHoy,
      )
      const examenes = await repository.leerExamenesDelPeriodo({
        alumnoId,
        desde,
        hasta,
        ...(query.materiaId !== undefined && { materiaIds: [query.materiaId] }),
      })

      return {
        alumno: {
          nombre: alumno.nombre,
          apellido: alumno.apellido,
          dni: alumno.dni,
          nivelEscolaridad: alumno.nivelEscolaridad,
        },
        mes: mesDelPeriodo(desde, hasta),
        desde,
        hasta,
        filtros: await filtrosDelDocumento(alumnoId, query, fechaHoy),
        grupos,
        cancelados: canceladosDeLosGrupos(grupos),
        examenes,
      }
    },
  }
}

export type HistorialesService = ReturnType<typeof crearHistorialesService>
