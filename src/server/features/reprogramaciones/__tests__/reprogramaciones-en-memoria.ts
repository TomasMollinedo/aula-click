import { vi } from 'vitest'
import {
  crearTurnosEnMemoria,
  type BloqueDePrueba,
  type TurnoDePrueba,
} from '@/server/features/turnos/__tests__/turnos-en-memoria'
import {
  leerOcurrencias,
  ocupacionEn,
  superposicionesDelAlumno,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import type { ReprogramacionesRepository } from '../reprogramaciones.repository'
import type { SnapshotReprogramacion } from '../reprogramaciones.validation'

// `reprogramacionesRepository` en memoria para los tests del service (T-49). Arma el snapshot con
// el **motor de ocurrencias real** (`leerOcurrencias`, `ocupacionEn`, `superposicionesDelAlumno`)
// sobre la tabla en memoria de `turnos`, ejecuta el `planificar` real que le pasa el service y
// aplica el plan a las tablas como lo hace el repository: así se ven los turnos, las cancelaciones,
// los pagos y la finalización que quedan. Si `planificar` lanza, no se escribe nada.

export type TurnoEnMemoria = TurnoDePrueba & {
  observaciones?: string | null
  temas?: string | null
}

export type Auditoria = { createdById: string; updatedById: string }

/** Datos del profesor, la materia y la asignación del destino, que los tests pueden cambiar. */
export type Catalogo = {
  profesores: Map<number, { capacidad: number; estado: 'ACTIVO' | 'INACTIVO' }>
  materia: { estado: 'ACTIVO' | 'INACTIVO' } | null
  asignacion: { estado: 'ACTIVO' | 'INACTIVO' } | null
  aulaCapacidad: number
}

export function crearReprogramacionesEnMemoria(
  bloques: BloqueDePrueba[],
  turnos: TurnoEnMemoria[],
  catalogo: Catalogo,
) {
  const base = crearTurnosEnMemoria(bloques, turnos)
  const cliente = { turno: { findMany: base.findMany } } as unknown as ClienteOcurrencias
  /** Creador y último modificador de cada turno, por id. */
  const auditoria = new Map<number, Auditoria>()
  let siguienteId = 100

  const reprogramar = vi.fn<ReprogramacionesRepository['reprogramar']>(
    async (entrada, planificar, actor: Actor, reloj) => {
      const { turnoId, fecha, alumnoId, bloqueDestinoId, profesorDestinoId, fechaDestino } = entrada
      const excluir = { turnoId, fecha }
      const original = turnos.find((t) => t.id === turnoId)
      const destino = bloques.find((b) => b.id === bloqueDestinoId)
      const horaFin = (b: BloqueDePrueba) => b.horaFin ?? b.horaInicio + 60

      const [ocurrencia] = await leerOcurrencias(
        cliente,
        { desde: fecha, hasta: fecha, turnoIds: [turnoId] },
        reloj,
      )
      const profesor = catalogo.profesores.get(profesorDestinoId)
      const snapshot: SnapshotReprogramacion = {
        ocurrencia: ocurrencia ?? null,
        turno:
          (original && {
            observaciones: original.observaciones ?? null,
            temas: original.temas ?? null,
            tieneFinalizacion: original.finalizadaDesde !== undefined,
          }) ??
          null,
        destino:
          (destino && {
            id: destino.id,
            estado: destino.estado ?? 'ACTIVO',
            profesorId: destino.profesorId,
            diaSemana: destino.diaSemana,
            horaInicio: destino.horaInicio,
            horaFin: horaFin(destino),
            aulaCapacidad: catalogo.aulaCapacidad,
          }) ??
          null,
        profesor:
          (profesor && {
            id: profesorDestinoId,
            capacidad: profesor.capacidad,
            estado: profesor.estado,
            apellido: `Apellido${profesorDestinoId}`,
          }) ??
          null,
        materia: catalogo.materia,
        asignacion: catalogo.asignacion,
        ocupacionDestino: await ocupacionEn(cliente, {
          bloqueAgendaId: bloqueDestinoId,
          fecha: fechaDestino,
          excluir,
        }),
        superpuestas: destino
          ? await superposicionesDelAlumno(
              cliente,
              {
                alumnoId,
                fecha: fechaDestino,
                horaInicio: destino.horaInicio,
                horaFin: horaFin(destino),
                excluir,
              },
              reloj,
            )
          : [],
      }

      const plan = planificar(snapshot)
      if (!original || !ocurrencia) throw new Error('inalcanzable: planificar ya lo verificó')

      // Aplica el plan, como el repository.
      const copia = {
        alumnoId: original.alumnoId ?? 12,
        materiaId: original.materiaId ?? 3,
        observaciones: original.observaciones ?? null,
        temas: original.temas ?? null,
      }
      const crear = (nuevo: Omit<TurnoEnMemoria, 'id'>) => {
        const turno = { id: siguienteId++, ...nuevo }
        turnos.push(turno)
        auditoria.set(turno.id, { createdById: actor.userId, updatedById: actor.userId })
        return turno
      }
      const tramo = plan.tramoNuevo
        ? crear({
            ...copia,
            bloqueAgendaId: original.bloqueAgendaId,
            tipo: 'RECURRENTE',
            serieId: plan.tramoNuevo.serieId,
            fechaInicio: plan.tramoNuevo.fechaInicio,
            fechaFin: plan.tramoNuevo.fechaFin,
          })
        : null
      const sesion = plan.sesionNueva
        ? crear({
            ...copia,
            bloqueAgendaId: bloqueDestinoId,
            tipo: 'SESION_UNICA',
            serieId: null,
            fechaInicio: fechaDestino,
            fechaFin: fechaDestino,
          })
        : null

      const pagoMovido = original.pagos?.find((p) => p.fecha === fecha)
      const posteriores = <T extends { fecha: string }>(lista: T[] = []) =>
        lista.filter((x) => x.fecha > fecha)
      if (tramo && plan.reapuntarPosterioresAlTramo) {
        tramo.cancelaciones = posteriores(original.cancelaciones)
        tramo.pagos = posteriores(original.pagos)
        original.cancelaciones = (original.cancelaciones ?? []).filter((c) => c.fecha <= fecha)
        original.pagos = (original.pagos ?? []).filter((p) => p.fecha <= fecha)
      }
      if (tramo && plan.finalizacionAlTramo) {
        tramo.finalizadaDesde = original.finalizadaDesde
        delete original.finalizadaDesde
      }
      if (plan.borrarFinalizacion) delete original.finalizadaDesde

      const { original: cambios } = plan
      if (cambios.tipo !== undefined) original.tipo = cambios.tipo
      if (cambios.bloqueAgendaId !== undefined) original.bloqueAgendaId = cambios.bloqueAgendaId
      if (cambios.fechaInicio !== undefined) original.fechaInicio = cambios.fechaInicio
      if (cambios.fechaFin !== undefined) original.fechaFin = cambios.fechaFin
      if (cambios.serieId !== undefined) original.serieId = cambios.serieId
      auditoria.set(original.id, {
        createdById: auditoria.get(original.id)?.createdById ?? 'usr_alta',
        updatedById: actor.userId,
      })

      const resultante = sesion ?? original
      if (plan.moverPago && pagoMovido) {
        original.pagos = (original.pagos ?? []).filter((p) => p !== pagoMovido)
        resultante.pagos = [...(resultante.pagos ?? []), { ...pagoMovido, fecha: fechaDestino }]
      }
      return { turnoId: resultante.id, cambio: plan.cambio }
    },
  )

  return { repository: { reprogramar }, auditoria }
}
