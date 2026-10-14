import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errors'
import { plazoDeAsistencia } from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import type { IndicacionesAnteriores } from '../asistencias.condiciones'
import type {
  AsistenciasRepository,
  EscrituraAsistencia,
  FiltroAsistencias,
  OcurrenciaDelProfesor,
} from '../asistencias.repository'
import { crearAsistenciasService } from '../asistencias.service'
import { registrarAsistenciasSchema, type RegistrarAsistencias } from '../asistencias.validation'

// Reloj fijo: hoy es el miércoles 14/10/2026 (12:00 en Salta).
const reloj = () => new Date('2026-10-14T15:00:00Z')
const HOY = '2026-10-14'
const actor: Actor = { userId: 'usr_prof', role: 'PROFESOR' }
const PROFESOR = 5
const OTRO_PROFESOR = 6

type Base = Omit<OcurrenciaDelProfesor, 'estado' | 'asistencia' | 'plazoAsistencia'> & {
  cancelada?: boolean
}

let id = 0
/** Una hora de un turno en una fecha (horas en minutos). */
function hora(parcial: Partial<Base> & { fecha: string; horaInicio: number }): Base {
  id += 1
  return {
    turnoId: id,
    bloqueAgendaId: 100 + parcial.horaInicio / 60,
    horaFin: parcial.horaInicio + 60,
    profesorId: PROFESOR,
    alumnoId: 12,
    materiaId: 3,
    temas: 'Ecuaciones',
    alumno: { id: 12, nombre: 'Juan', apellido: 'Pérez', avatarKey: null },
    materia: { id: 3, nombre: 'Matemática' },
    aula: { id: 1, nombre: 'Aula 1' },
    ...parcial,
  }
}

/**
 * Repository en memoria: el estado y el plazo los calcula como el motor (T-74) con el reloj
 * fijo; `registrar` relee, llama a `verificar` y aplica las escrituras con su auditoría.
 */
function repositorioEnMemoria(horas: Base[]) {
  const asistencias = new Map<
    string,
    EscrituraAsistencia & { createdById: string; updatedById: string }
  >()
  const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

  function leer(filtro: FiltroAsistencias): OcurrenciaDelProfesor[] {
    return horas
      .filter(
        (h) =>
          h.profesorId === filtro.profesorId &&
          h.fecha >= filtro.desde &&
          h.fecha <= filtro.hasta &&
          (filtro.turnoIds === undefined || filtro.turnoIds.includes(h.turnoId)),
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio - b.horaInicio)
      .map(({ cancelada, ...h }) => {
        const a = asistencias.get(clave(h.turnoId, h.fecha))
        const estado = cancelada
          ? 'CANCELADO'
          : a
            ? a.estado === 'PRESENTE'
              ? 'REALIZADO'
              : 'AUSENTE'
            : h.fecha < HOY
              ? 'SIN_REGISTRAR'
              : 'AGENDADO'
        return {
          ...h,
          estado,
          asistencia: a
            ? {
                estado: a.estado,
                trabajado: a.trabajado,
                indicaciones: a.indicaciones,
                observacion: a.observacion,
              }
            : null,
          plazoAsistencia: cancelada || h.fecha > HOY ? null : plazoDeAsistencia(h.fecha, HOY),
        } as OcurrenciaDelProfesor
      })
  }

  const repository = {
    leer: vi.fn(async (filtro: FiltroAsistencias) => leer(filtro)),
    ultimasIndicaciones: vi.fn(
      async (items: readonly unknown[]): Promise<(IndicacionesAnteriores | null)[]> =>
        items.map(() => null),
    ),
    registrar: vi.fn(
      async (
        entrada: { alumnoIds: number[]; filtro: FiltroAsistencias },
        verificar: (o: OcurrenciaDelProfesor[]) => EscrituraAsistencia[],
        quien: Actor,
      ) => {
        for (const e of verificar(leer(entrada.filtro))) {
          const previa = asistencias.get(clave(e.turnoId, e.fecha))
          asistencias.set(clave(e.turnoId, e.fecha), {
            ...e,
            createdById: previa?.createdById ?? quien.userId,
            updatedById: quien.userId,
          })
        }
        return leer(entrada.filtro)
      },
    ),
  } satisfies Pick<AsistenciasRepository, 'leer' | 'ultimasIndicaciones' | 'registrar'>

  return { repository, asistencias }
}

function crear(horas: Base[], profesorId: number | null = PROFESOR) {
  const memoria = repositorioEnMemoria(horas)
  const service = crearAsistenciasService({
    repository: memoria.repository,
    profesoresRepository: { buscarIdPorUsuario: vi.fn(async () => profesorId) },
    getPresignedUrl: vi.fn(async (key: string) => `https://s3/${key}`),
    reloj,
  })
  return { service, ...memoria }
}

const presente = (
  ocurrencias: Base[],
  textos: Partial<RegistrarAsistencias['registros'][number]> = {},
): RegistrarAsistencias['registros'][number] => ({
  ocurrencias: ocurrencias.map((o) => ({ turnoId: o.turnoId, fecha: o.fecha })),
  estado: 'PRESENTE',
  ...textos,
})

beforeEach(() => {
  id = 0
})

describe('registrar', () => {
  it('un alumno de tres horas seguidas: una sola vez, las tres "Realizado" con los mismos textos', async () => {
    const tres = [480, 540, 600].map((h) => hora({ fecha: HOY, horaInicio: h }))
    const { service, asistencias } = crear(tres)

    const { filas } = await service.registrar(
      {
        registros: [
          presente(tres, { trabajado: 'Despeje', indicaciones: 'Repasar ejercicios 1 a 5' }),
        ],
      },
      actor,
    )

    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ horaInicio: '08:00', horaFin: '11:00', horas: 3 })
    for (const o of filas[0]?.ocurrencias ?? []) {
      expect(o.estado).toBe('REALIZADO')
      expect(o.asistencia).toEqual({
        estado: 'PRESENTE',
        trabajado: 'Despeje',
        indicaciones: 'Repasar ejercicios 1 a 5',
        observacion: null,
      })
    }
    expect(asistencias.size).toBe(3)
  })

  it('ausente: guarda la observación y deja trabajado e indicaciones en null', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480 })
    const { service, asistencias } = crear([h])

    await service.registrar(
      {
        registros: [
          {
            ocurrencias: [{ turnoId: h.turnoId, fecha: HOY }],
            estado: 'AUSENTE',
            observacion: 'Avisó que estaba enfermo',
          },
        ],
      },
      actor,
    )

    expect([...asistencias.values()][0]).toMatchObject({
      estado: 'AUSENTE',
      trabajado: null,
      indicaciones: null,
      observacion: 'Avisó que estaba enfermo',
    })
  })

  it('corregir es registrar otra vez: la misma fila, con el actor como modificador', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480 })
    const { service, asistencias } = crear([h])
    await service.registrar({ registros: [presente([h])] }, actor)

    const otro: Actor = { userId: 'usr_prof_2', role: 'PROFESOR' }
    const { filas } = await service.registrar(
      {
        registros: [{ ocurrencias: [{ turnoId: h.turnoId, fecha: HOY }], estado: 'AUSENTE' }],
      },
      otro,
    )

    expect(asistencias.size).toBe(1)
    expect([...asistencias.values()][0]).toMatchObject({
      estado: 'AUSENTE',
      createdById: 'usr_prof',
      updatedById: 'usr_prof_2',
    })
    expect(filas[0]?.ocurrencias[0]?.estado).toBe('AUSENTE')
  })

  it('"marcar todos presentes" sólo con las filas sin asistencia no pisa lo registrado', async () => {
    const alumno = (id: number) => ({ id, nombre: 'X', apellido: 'Y', avatarKey: null })
    const ausente = hora({ fecha: HOY, horaInicio: 480, alumnoId: 20, alumno: alumno(20) })
    const libre = hora({ fecha: HOY, horaInicio: 600, alumnoId: 21, alumno: alumno(21) })
    const { service, asistencias } = crear([ausente, libre])
    await service.registrar(
      {
        registros: [{ ocurrencias: [{ turnoId: ausente.turnoId, fecha: HOY }], estado: 'AUSENTE' }],
      },
      actor,
    )

    const dia = await service.delDia({}, actor)
    const sinAsistencia = dia.clases
      .flatMap((c) => c.filas)
      .filter((f) => f.ocurrencias.every((o) => o.asistencia === null))
    await service.registrar(
      {
        registros: sinAsistencia.map((f) => ({
          ocurrencias: f.ocurrencias.map((o) => ({ turnoId: o.turnoId, fecha: o.fecha })),
          estado: 'PRESENTE' as const,
        })),
      },
      actor,
    )

    expect(asistencias.get(`${ausente.turnoId}|${HOY}`)?.estado).toBe('AUSENTE')
    expect(asistencias.get(`${libre.turnoId}|${HOY}`)?.estado).toBe('PRESENTE')
  })

  it('una ocurrencia de otro profesor → 403 y no se escribe nada', async () => {
    const propia = hora({ fecha: HOY, horaInicio: 480 })
    const ajena = hora({ fecha: HOY, horaInicio: 600, profesorId: OTRO_PROFESOR })
    const { service, asistencias } = crear([propia, ajena])

    await expect(
      service.registrar({ registros: [presente([propia]), presente([ajena])] }, actor),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(asistencias.size).toBe(0)
  })

  it('una ocurrencia que no existe → 403', async () => {
    const { service } = crear([])

    await expect(
      service.registrar(
        { registros: [{ ocurrencias: [{ turnoId: 99, fecha: HOY }], estado: 'PRESENTE' }] },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('una ocurrencia cancelada → 409 TURNO_CANCELADO', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480, cancelada: true })
    const { service } = crear([h])

    const error = await service.registrar({ registros: [presente([h])] }, actor).catch((e) => e)
    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'TURNO_CANCELADO' })
  })

  it('una fecha futura → 400 en esa ocurrencia, sin leer la base', async () => {
    const h = hora({ fecha: '2026-10-15', horaInicio: 480 })
    const { service, repository } = crear([h])

    const error = await service.registrar({ registros: [presente([h])] }, actor).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      expect.objectContaining({ path: ['registros', 0, 'ocurrencias', 0, 'fecha'] }),
    ])
    expect(repository.leer).not.toHaveBeenCalled()
  })

  it('el día 7 se acepta y el 8 da 409 FUERA_DE_PLAZO con la fecha de vencimiento', async () => {
    const dia7 = hora({ fecha: '2026-10-07', horaInicio: 480 })
    const dia8 = hora({ fecha: '2026-10-06', horaInicio: 480 })
    const { service } = crear([dia7, dia8])

    await expect(service.registrar({ registros: [presente([dia7])] }, actor)).resolves.toBeDefined()

    const error = await service.registrar({ registros: [presente([dia8])] }, actor).catch((e) => e)
    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      code: 'FUERA_DE_PLAZO',
      message: 'El plazo para registrar esta asistencia venció el 13/10',
    })
  })

  it.each([
    ['con un hueco', [480, 600], {}],
    ['de otro alumno', [480, 540], { alumnoId: 99 }],
    ['de otra materia', [480, 540], { materiaId: 99 }],
  ])('horas que no son seguidas (%s) → 400', async (_caso, inicios, distinto) => {
    const [primera, segunda] = inicios.map((h) => hora({ fecha: HOY, horaInicio: h }))
    const { service } = crear([primera as Base, { ...(segunda as Base), ...distinto }])

    const error = await service
      .registrar({ registros: [presente([primera as Base, segunda as Base])] }, actor)
      .catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([
      expect.objectContaining({ path: ['registros', 0, 'ocurrencias'] }),
    ])
  })

  it('una ocurrencia repetida en el pedido → 400', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480 })
    const { service } = crear([h])

    await expect(
      service.registrar({ registros: [presente([h]), presente([h])] }, actor),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('bloquea los alumnos de las ocurrencias pedidas y vuelve a verificar al releer', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480, alumnoId: 12 })
    const { service, repository } = crear([h])

    await service.registrar({ registros: [presente([h])] }, actor)

    expect(repository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ alumnoIds: [12] }),
      expect.any(Function),
      actor,
      reloj,
    )
  })

  it('un usuario sin ficha de profesor → 404', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480 })
    const { service } = crear([h], null)

    await expect(service.registrar({ registros: [presente([h])] }, actor)).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })
})

describe('body de PUT /asistencias (Zod)', () => {
  const ocurrencias = [{ turnoId: 1, fecha: HOY }]

  it.each(['trabajado', 'indicaciones'])('ausente con %s → 400 en ese campo', (campo) => {
    const resultado = registrarAsistenciasSchema.safeParse({
      registros: [{ ocurrencias, estado: 'AUSENTE', [campo]: 'algo' }],
    })

    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.path).toEqual(['registros', 0, campo])
  })

  it('los largos máximos: 1000 para los textos de presente y 500 para la observación', () => {
    const largo = (n: number) => 'x'.repeat(n)
    const parse = (registro: Record<string, unknown>) =>
      registrarAsistenciasSchema.safeParse({ registros: [{ ocurrencias, ...registro }] }).success

    expect(parse({ estado: 'PRESENTE', trabajado: largo(1000), indicaciones: largo(1000) })).toBe(
      true,
    )
    expect(parse({ estado: 'PRESENTE', trabajado: largo(1001) })).toBe(false)
    expect(parse({ estado: 'AUSENTE', observacion: largo(500) })).toBe(true)
    expect(parse({ estado: 'AUSENTE', observacion: largo(501) })).toBe(false)
  })

  it('un registro sin ocurrencias → 400', () => {
    expect(
      registrarAsistenciasSchema.safeParse({ registros: [{ ocurrencias: [], estado: 'PRESENTE' }] })
        .success,
    ).toBe(false)
  })
})

describe('delDia', () => {
  it('sin fecha es hoy: clases en orden horario, cada fila en la clase de su primera hora', async () => {
    const seguidas = [540, 600].map((h) => hora({ fecha: HOY, horaInicio: h }))
    const otra = {
      ...hora({ fecha: HOY, horaInicio: 480 }),
      alumnoId: 20,
      alumno: { id: 20, nombre: 'Ana', apellido: 'Gómez', avatarKey: 'alumnos/20.jpg' },
    }
    const cancelada = { ...hora({ fecha: HOY, horaInicio: 720, cancelada: true }), alumnoId: 21 }
    const { service } = crear([...seguidas, otra, cancelada])

    const dia = await service.delDia({}, actor)

    expect(dia).toMatchObject({
      fecha: HOY,
      plazo: { vence: '2026-10-21', vencido: false },
      editable: true,
    })
    expect(dia.clases.map((c) => [c.horaInicio, c.filas.length])).toEqual([
      ['08:00', 1],
      ['09:00', 1],
      ['10:00', 0],
    ])
    expect(dia.clases[0]?.filas[0]?.alumno).toEqual({
      id: 20,
      apellido: 'Gómez',
      nombre: 'Ana',
      fotoUrl: 'https://s3/alumnos/20.jpg',
    })
    expect(dia.clases[1]?.filas[0]).toMatchObject({
      horaInicio: '09:00',
      horaFin: '11:00',
      horas: 2,
      temas: 'Ecuaciones',
    })
  })

  it('pide las indicaciones anteriores de cada fila en una sola llamada', async () => {
    const h = hora({ fecha: HOY, horaInicio: 480 })
    const { service, repository } = crear([h])
    repository.ultimasIndicaciones.mockResolvedValueOnce([
      { fecha: '2026-10-07', indicaciones: 'Traer la carpeta' },
    ])

    const dia = await service.delDia({}, actor)

    expect(repository.ultimasIndicaciones).toHaveBeenCalledTimes(1)
    expect(repository.ultimasIndicaciones).toHaveBeenCalledWith([
      { alumnoId: 12, materiaId: 3, antesDe: HOY },
    ])
    expect(dia.clases[0]?.filas[0]?.indicacionesAnteriores).toEqual({
      fecha: '2026-10-07',
      indicaciones: 'Traer la carpeta',
    })
  })

  it('un día vencido se ve en sólo lectura', async () => {
    const h = hora({ fecha: '2026-10-01', horaInicio: 480 })
    const { service } = crear([h])

    const dia = await service.delDia({ fecha: '2026-10-01' }, actor)

    expect(dia).toMatchObject({ plazo: { vence: '2026-10-08', vencido: true }, editable: false })
    expect(dia.clases[0]?.filas[0]?.ocurrencias[0]?.estado).toBe('SIN_REGISTRAR')
  })

  it('una fecha futura → 400 en `fecha`', async () => {
    const { service } = crear([])

    const error = await service.delDia({ fecha: '2026-10-15' }, actor).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.details).toEqual([expect.objectContaining({ path: ['fecha'] })])
  })

  it('sólo trae las clases del profesor de la sesión', async () => {
    const ajena = hora({ fecha: HOY, horaInicio: 480, profesorId: OTRO_PROFESOR })
    const { service } = crear([ajena])

    expect((await service.delDia({}, actor)).clases).toEqual([])
  })
})

describe('pendientes', () => {
  it('cuenta los sin registrar de días anteriores en plazo y da el más antiguo', async () => {
    const enPlazo = [
      hora({ fecha: '2026-10-07', horaInicio: 480 }),
      hora({ fecha: '2026-10-07', horaInicio: 540 }),
      hora({ fecha: '2026-10-13', horaInicio: 480 }),
    ]
    const vencido = hora({ fecha: '2026-10-06', horaInicio: 480 })
    const deHoy = hora({ fecha: HOY, horaInicio: 480 })
    const cancelado = hora({ fecha: '2026-10-12', horaInicio: 480, cancelada: true })
    const registrado = hora({ fecha: '2026-10-12', horaInicio: 540 })
    const { service } = crear([...enPlazo, vencido, deHoy, cancelado, registrado])
    await service.registrar({ registros: [presente([registrado])] }, actor)

    expect(await service.pendientes(actor)).toEqual({
      cantidad: 3,
      masAntiguo: { fecha: '2026-10-07', vence: '2026-10-14' },
    })
  })

  it('sin turnos en plazo: cantidad 0 y masAntiguo null', async () => {
    const { service } = crear([hora({ fecha: '2026-10-01', horaInicio: 480 })])

    expect(await service.pendientes(actor)).toEqual({ cantidad: 0, masAntiguo: null })
  })
})
