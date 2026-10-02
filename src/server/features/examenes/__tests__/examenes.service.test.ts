import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, ForbiddenError, NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import type { ExamenesRepository } from '../examenes.repository'
import {
  CODIGO_EXAMEN_PENDIENTE,
  CODIGO_MATERIA_INACTIVA,
  crearExamenesService,
} from '../examenes.service'
import type { ExamenGuardado } from '../examenes.validation'

// Los repositories se reemplazan por falsos: sin Docker ni Postgres. El service los importa solo
// como tipo, así que no hace falta mockear los módulos reales.

const reloj = () => new Date('2026-10-05T15:00:00Z') // hoy = 2026-10-05 en America/Argentina/Salta

const actorMesa: Actor = { userId: 'usr_mesa', role: 'MESA_ENTRADAS' }
const actorProfesor: Actor = { userId: 'usr_prof', role: 'PROFESOR' }

const auditoriaMesa = {
  id: 'usr_mesa',
  nombre: 'Ana',
  apellido: 'Pérez',
  role: 'MESA_ENTRADAS',
} as const

function examen(campos: Partial<ExamenGuardado> = {}): ExamenGuardado {
  return {
    id: 1,
    alumnoId: 12,
    materiaId: 3,
    materia: { id: 3, nombre: 'Matemática' },
    fecha: '2026-10-15',
    tipo: 'PARCIAL',
    observaciones: null,
    createdAt: '2026-09-22T13:45:00.000Z',
    updatedAt: '2026-09-22T13:45:00.000Z',
    createdBy: auditoriaMesa,
    updatedBy: auditoriaMesa,
    ...campos,
  }
}

function crearRepository() {
  return {
    listarDelAlumno: vi.fn<ExamenesRepository['listarDelAlumno']>(),
    buscarPorId: vi.fn<ExamenesRepository['buscarPorId']>(),
    buscarPendiente: vi.fn<ExamenesRepository['buscarPendiente']>(),
    crear: vi.fn<ExamenesRepository['crear']>(),
    actualizar: vi.fn<ExamenesRepository['actualizar']>(),
    darDeBaja: vi.fn<ExamenesRepository['darDeBaja']>(),
    materiasDictadas: vi.fn<ExamenesRepository['materiasDictadas']>(),
  }
}

function crearAlumnosRepository() {
  return { buscarPorId: vi.fn<AlumnosRepository['buscarPorId']>() }
}

function crearMateriasRepository() {
  return {
    listarActivas: vi.fn<MateriasRepository['listarActivas']>(),
    buscarPorIds: vi.fn<MateriasRepository['buscarPorIds']>(),
  }
}

function crearProfesoresRepository() {
  return { buscarIdPorUsuario: vi.fn<ProfesoresRepository['buscarIdPorUsuario']>() }
}

let repository: ReturnType<typeof crearRepository>
let alumnosRepository: ReturnType<typeof crearAlumnosRepository>
let materiasRepository: ReturnType<typeof crearMateriasRepository>
let profesoresRepository: ReturnType<typeof crearProfesoresRepository>
let service: ReturnType<typeof crearExamenesService>

beforeEach(() => {
  repository = crearRepository()
  alumnosRepository = crearAlumnosRepository()
  materiasRepository = crearMateriasRepository()
  profesoresRepository = crearProfesoresRepository()
  service = crearExamenesService({
    repository,
    alumnosRepository,
    materiasRepository,
    profesoresRepository,
    reloj,
  })

  alumnosRepository.buscarPorId.mockResolvedValue({ id: 12 } as never)
  materiasRepository.buscarPorIds.mockResolvedValue([
    { id: 3, nombre: 'Matemática', estado: 'ACTIVO' },
  ])
  repository.buscarPendiente.mockResolvedValue(null)
  repository.crear.mockImplementation(async (datos, actor) =>
    examen({
      alumnoId: datos.alumnoId,
      materiaId: datos.materiaId,
      materia: { id: datos.materiaId, nombre: 'Matemática' },
      fecha: datos.fecha,
      tipo: datos.tipo,
      observaciones: datos.observaciones ?? null,
      createdBy: { ...auditoriaMesa, id: actor.userId, role: actor.role },
      updatedBy: { ...auditoriaMesa, id: actor.userId, role: actor.role },
    }),
  )
})

describe('listar', () => {
  it('separa próximos (con diasRestantes) de pasados (sin diasRestantes)', async () => {
    repository.listarDelAlumno.mockResolvedValue([
      examen({ id: 1, fecha: '2026-10-05' }), // hoy: próximo, 0 días
      examen({ id: 2, fecha: '2026-10-15' }), // próximo, 10 días
      examen({ id: 3, fecha: '2026-09-01' }), // pasado
    ])

    const listado = await service.listar(12)

    expect(listado.proximos.map((e) => [e.id, e.diasRestantes, e.pasado])).toEqual([
      [1, 0, false],
      [2, 10, false],
    ])
    expect(listado.pasados.map((e) => [e.id, e.diasRestantes, e.pasado])).toEqual([[3, null, true]])
  })

  it('sin exámenes, listas vacías', async () => {
    repository.listarDelAlumno.mockResolvedValue([])
    expect(await service.listar(12)).toEqual({ proximos: [], pasados: [] })
  })
})

describe('materiasOfrecibles', () => {
  it('mesa de entradas: las activas del catálogo', async () => {
    materiasRepository.listarActivas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])

    expect(await service.materiasOfrecibles(12, actorMesa)).toEqual([
      { id: 3, nombre: 'Matemática' },
    ])
    expect(repository.materiasDictadas).not.toHaveBeenCalled()
  })

  it('profesor: las que le dicta a ese alumno', async () => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(8)
    repository.materiasDictadas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])

    expect(await service.materiasOfrecibles(12, actorProfesor)).toEqual([
      { id: 3, nombre: 'Matemática' },
    ])
    expect(repository.materiasDictadas).toHaveBeenCalledWith(8, 12)
  })

  it('profesor sin fila de Profesor (no debería pasar): lista vacía, no revienta', async () => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(null)
    expect(await service.materiasOfrecibles(12, actorProfesor)).toEqual([])
  })
})

describe('crear', () => {
  const datos = { alumnoId: 12, materiaId: 3, fecha: '2026-10-20', tipo: 'PARCIAL' as const }

  it('alumno inexistente: 404', async () => {
    alumnosRepository.buscarPorId.mockResolvedValue(null)
    await expect(service.crear(datos, actorMesa)).rejects.toThrow(NotFoundError)
  })

  it('materia inexistente: 404', async () => {
    materiasRepository.buscarPorIds.mockResolvedValue([])
    await expect(service.crear(datos, actorMesa)).rejects.toThrow(NotFoundError)
  })

  it('materia inactiva: 409 MATERIA_INACTIVA', async () => {
    materiasRepository.buscarPorIds.mockResolvedValue([
      { id: 3, nombre: 'Matemática', estado: 'INACTIVO' },
    ])

    const error = await service.crear(datos, actorMesa).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe(CODIGO_MATERIA_INACTIVA)
  })

  it('ya hay un examen pendiente de esa materia: 409 EXAMEN_PENDIENTE con el existente', async () => {
    repository.buscarPendiente.mockResolvedValue({ id: 9, tipo: 'FINAL', fecha: '2026-10-25' })

    const error = await service.crear(datos, actorMesa).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe(CODIGO_EXAMEN_PENDIENTE)
    expect(error.details).toEqual({ id: 9, tipo: 'FINAL', fecha: '2026-10-25' })
  })

  it('el anterior ya pasó: no cuenta como pendiente, se puede cargar el siguiente', async () => {
    // `buscarPendiente` ya filtra por fecha >= hoy: un pasado no se lo pasa el repository falso.
    repository.buscarPendiente.mockResolvedValue(null)
    await expect(service.crear(datos, actorMesa)).resolves.toMatchObject({ materia: { id: 3 } })
  })

  it('fecha pasada permitida: la respuesta trae pasado: true', async () => {
    const creado = await service.crear({ ...datos, fecha: '2026-09-01' }, actorMesa)
    expect(creado.pasado).toBe(true)
  })

  it('fecha futura: pasado: false', async () => {
    const creado = await service.crear(datos, actorMesa)
    expect(creado.pasado).toBe(false)
  })

  it('profesor con materia ajena (no se la dicta a este alumno): 403', async () => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(8)
    repository.materiasDictadas.mockResolvedValue([{ id: 5, nombre: 'Física' }]) // no incluye la 3

    await expect(service.crear(datos, actorProfesor)).rejects.toThrow(ForbiddenError)
  })

  it('profesor con la materia asignada a ese alumno: la puede cargar', async () => {
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(8)
    repository.materiasDictadas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])

    await expect(service.crear(datos, actorProfesor)).resolves.toMatchObject({ materia: { id: 3 } })
  })

  it('mesa de entradas no tiene la restricción de materia propia', async () => {
    await service.crear(datos, actorMesa)
    expect(repository.materiasDictadas).not.toHaveBeenCalled()
  })
})

describe('editar', () => {
  it('examen inexistente: 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    await expect(service.editar(1, { fecha: '2026-10-20' }, actorMesa)).rejects.toThrow(
      NotFoundError,
    )
  })

  it('sin cambiar materia ni fecha: no vuelve a chequear el pendiente', async () => {
    repository.buscarPorId.mockResolvedValue(examen())
    repository.actualizar.mockResolvedValue(examen({ observaciones: 'Nuevo dato' }))

    await service.editar(1, { observaciones: 'Nuevo dato' }, actorMesa)

    expect(repository.buscarPendiente).not.toHaveBeenCalled()
  })

  it('cambia la fecha a una con otro examen pendiente en la materia: 409, sin contar el propio', async () => {
    repository.buscarPorId.mockResolvedValue(examen({ id: 1, materiaId: 3 }))
    repository.buscarPendiente.mockResolvedValue({ id: 9, tipo: 'FINAL', fecha: '2026-10-25' })

    const error = await service.editar(1, { fecha: '2026-10-25' }, actorMesa).catch((e) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error.code).toBe(CODIGO_EXAMEN_PENDIENTE)
    expect(repository.buscarPendiente).toHaveBeenCalledWith(12, 3, '2026-10-05', 1)
  })

  it('cambia a una materia inactiva: 409 MATERIA_INACTIVA', async () => {
    repository.buscarPorId.mockResolvedValue(examen())
    materiasRepository.buscarPorIds.mockResolvedValue([
      { id: 5, nombre: 'Física', estado: 'INACTIVO' },
    ])

    await expect(service.editar(1, { materiaId: 5 }, actorMesa)).rejects.toThrow(ConflictError)
  })

  it('profesor mueve el examen a una materia que no le dicta a ese alumno: 403', async () => {
    repository.buscarPorId.mockResolvedValue(examen({ alumnoId: 12 }))
    materiasRepository.buscarPorIds.mockResolvedValue([
      { id: 5, nombre: 'Física', estado: 'ACTIVO' },
    ])
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(8)
    repository.materiasDictadas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }]) // no incluye la 5

    await expect(service.editar(1, { materiaId: 5 }, actorProfesor)).rejects.toThrow(ForbiddenError)
  })

  it('edita observaciones: devuelve el detalle actualizado', async () => {
    repository.buscarPorId.mockResolvedValue(examen())
    repository.actualizar.mockResolvedValue(examen({ observaciones: 'Confirmado' }))

    const editado = await service.editar(1, { observaciones: 'Confirmado' }, actorMesa)

    expect(editado.observaciones).toBe('Confirmado')
  })
})

describe('darDeBaja', () => {
  it('examen inexistente: 404', async () => {
    repository.buscarPorId.mockResolvedValue(null)
    await expect(service.darDeBaja(1, actorMesa)).rejects.toThrow(NotFoundError)
  })

  it('da de baja y devuelve el detalle', async () => {
    repository.buscarPorId.mockResolvedValue(examen())
    repository.darDeBaja.mockResolvedValue(examen())

    const dado = await service.darDeBaja(1, actorMesa)

    expect(repository.darDeBaja).toHaveBeenCalledWith(1, actorMesa)
    expect(dado.id).toBe(1)
  })

  it('profesor con materia ajena: 403, no llega a dar de baja', async () => {
    repository.buscarPorId.mockResolvedValue(examen({ alumnoId: 12, materiaId: 3 }))
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(8)
    repository.materiasDictadas.mockResolvedValue([]) // no le dicta nada a este alumno

    await expect(service.darDeBaja(1, actorProfesor)).rejects.toThrow(ForbiddenError)
    expect(repository.darDeBaja).not.toHaveBeenCalled()
  })

  it('profesor con la materia asignada a ese alumno: puede darlo de baja', async () => {
    repository.buscarPorId.mockResolvedValue(examen({ alumnoId: 12, materiaId: 3 }))
    repository.darDeBaja.mockResolvedValue(examen())
    profesoresRepository.buscarIdPorUsuario.mockResolvedValue(8)
    repository.materiasDictadas.mockResolvedValue([{ id: 3, nombre: 'Matemática' }])

    await expect(service.darDeBaja(1, actorProfesor)).resolves.toMatchObject({ id: 1 })
  })
})
