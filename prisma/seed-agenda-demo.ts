// Seed de PRUEBA para ejercitar `GET /api/v1/turnos/agenda` (T-23) a mano, con Swagger UI o
// Postman. NO es el seed de desarrollo (`prisma/seed.ts`, que corre `pnpm db:seed`): este es un
// script aparte, pensado para correrse y volver a correrse las veces que haga falta.
//
// Requiere que el seed de desarrollo ya haya corrido (`pnpm db:seed`): reutiliza el usuario
// GERENTE, las materias y las aulas que ese seed crea; no los duplica.
//
// Idempotente por "limpiar y recrear": cada corrida borra únicamente lo que creó una corrida
// anterior de ESTE script (identificable por el dominio de email @agenda-demo.local) y lo vuelve
// a crear con fechas relativas a "hoy", para que la agenda de hoy siempre tenga datos aunque haya
// pasado un día desde la última corrida. Nunca toca al profesor, los alumnos ni los turnos que
// vos hayas cargado a mano o por la API.
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-agenda-demo.ts            crea (o recrea) los datos de prueba
//   pnpm exec tsx prisma/seed-agenda-demo.ts --limpiar   solo borra, no vuelve a crear nada
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, diaSemanaISO, fechaADate, hoy } from '@/server/shared/fechas'
import { horaAMinutos } from '@/server/shared/zod'

// Dominio reservado para identificar (y poder limpiar) lo que crea este script, y no confundirlo
// con cuentas reales o con las del seed de desarrollo (`@aulaclick.local`).
const DOMINIO_DEMO = 'agenda-demo.local'

const PROFESORES_DEMO = [
  { nombre: 'Valentina', apellido: 'Cruz', dni: '99900101', materia: 'Matemática', aula: 'Aula 1' },
  { nombre: 'Sofía', apellido: 'Ramírez', dni: '99900102', materia: 'Física', aula: 'Aula 2' },
  { nombre: 'Diego', apellido: 'Torres', dni: '99900103', materia: 'Química', aula: 'Aula 3' },
] as const

const ALUMNOS_DEMO = [
  { nombre: 'Julieta', apellido: 'Fernández', dni: '99900201', fechaNacimiento: '2001-03-12' },
  { nombre: 'Bruno', apellido: 'Suárez', dni: '99900202', fechaNacimiento: '1999-11-30' },
  { nombre: 'Camila', apellido: 'Flores', dni: '99900203', fechaNacimiento: '2003-07-08' },
  { nombre: 'Nicolás', apellido: 'Ibarra', dni: '99900204', fechaNacimiento: '2000-01-22' },
] as const

const emailDe = (nombre: string, apellido: string) =>
  `${normalizarBusqueda(nombre)}.${normalizarBusqueda(apellido)}@${DOMINIO_DEMO}`.replace(/ /g, '')

/** `fecha` (YYYY-MM-DD) + `dias` (puede ser negativo), sin usar `new Date(string)` a mano. */
function sumarDias(fecha: string, dias: number): string {
  const unDiaMs = 24 * 60 * 60 * 1000
  return dateAFecha(new Date(fechaADate(fecha).getTime() + dias * unDiaMs))
}

/** Actor y catálogo que ya deja el seed de desarrollo. Falla con un mensaje claro si falta algo. */
async function requisitos() {
  const gerente = await prisma.usuario.findFirst({ where: { role: 'GERENTE' } })
  const materias = await prisma.materia.findMany({
    where: { busqueda: { in: PROFESORES_DEMO.map((p) => normalizarBusqueda(p.materia)) } },
  })
  const aulas = await prisma.aula.findMany({
    where: { nombre: { in: PROFESORES_DEMO.map((p) => p.aula) } },
  })

  if (!gerente || materias.length < 3 || aulas.length < 3) {
    throw new Error(
      'Faltan datos del seed de desarrollo (usuario GERENTE, materias o aulas). ' +
        'Corré primero `pnpm db:seed` y volvé a intentar.',
    )
  }

  const materiaPorNombre = new Map(materias.map((m) => [m.busqueda, m]))
  const aulaPorNombre = new Map(aulas.map((a) => [a.nombre, a]))
  return { gerente, materiaPorNombre, aulaPorNombre }
}

/** Borra únicamente lo que creó una corrida anterior de este script (dominio `@agenda-demo.local`). */
async function limpiar() {
  const emailsProfesores = PROFESORES_DEMO.map((p) => emailDe(p.nombre, p.apellido))
  const emailsAlumnos = ALUMNOS_DEMO.map((a) => emailDe(a.nombre, a.apellido))

  const usuariosDemo = await prisma.usuario.findMany({
    where: { email: { in: emailsProfesores } },
    select: { id: true },
  })
  const usuarioIds = usuariosDemo.map((u) => u.id)
  const profesoresDemo = await prisma.profesor.findMany({
    where: { usuarioId: { in: usuarioIds } },
    select: { id: true },
  })
  const profesorIds = profesoresDemo.map((p) => p.id)
  const alumnosDemo = await prisma.alumno.findMany({
    where: { email: { in: emailsAlumnos } },
    select: { id: true },
  })
  const alumnoIds = alumnosDemo.map((a) => a.id)

  // Orden que respeta las FK (onDelete: Restrict): turnos y asignaciones antes que sus dueños.
  await prisma.turno.deleteMany({
    where: {
      OR: [{ bloqueAgenda: { profesorId: { in: profesorIds } } }, { alumnoId: { in: alumnoIds } }],
    },
  })
  await prisma.asignacionMateria.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.bloqueAgenda.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } })
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } })
  await prisma.alumno.deleteMany({ where: { id: { in: alumnoIds } } })

  console.log(
    `Limpieza: ${profesorIds.length} profesores, ${alumnoIds.length} alumnos y sus bloques/turnos.`,
  )
}

async function crear() {
  const { gerente, materiaPorNombre, aulaPorNombre } = await requisitos()
  const actor = gerente.id

  // --- Profesores demo, cada uno con su materia asignada (dominio.md: la materia del turno debe
  // estar asignada al profesor del bloque) ---
  const profesores = new Map<string, { id: number; materiaId: number; aulaId: number }>()
  for (const datos of PROFESORES_DEMO) {
    const materia = materiaPorNombre.get(normalizarBusqueda(datos.materia))!
    const aula = aulaPorNombre.get(datos.aula)!
    const usuario = await prisma.usuario.create({
      data: {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        telefono: '3870000000',
        email: emailDe(datos.nombre, datos.apellido),
        role: 'PROFESOR',
        // Sin Account/contraseña: alcanza con que exista para el bloque y el turno; no hace
        // falta poder iniciar sesión como este profesor para probar la agenda (la consulta mesa
        // de entradas).
      },
    })
    const profesor = await prisma.profesor.create({
      data: {
        usuarioId: usuario.id,
        titulo: `Profesor en ${datos.materia}`,
        matricula: `DEMO-${datos.dni}`,
        capacidad: 5,
      },
    })
    await prisma.asignacionMateria.create({
      data: {
        profesorId: profesor.id,
        materiaId: materia.id,
        createdById: actor,
        updatedById: actor,
      },
    })
    profesores.set(datos.apellido, { id: profesor.id, materiaId: materia.id, aulaId: aula.id })
  }

  // --- Alumnos demo ---
  const alumnos = new Map<string, number>()
  for (const datos of ALUMNOS_DEMO) {
    const alumno = await prisma.alumno.create({
      data: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        fechaNacimiento: fechaADate(datos.fechaNacimiento),
        telefono: '3870000000',
        email: emailDe(datos.nombre, datos.apellido),
        observaciones: 'Alumno de prueba (seed-agenda-demo.ts): se puede borrar sin problema.',
        createdById: actor,
        updatedById: actor,
      },
    })
    alumnos.set(datos.apellido, alumno.id)
  }

  // --- Fechas relativas a hoy, para que la agenda de hoy siempre tenga datos ---
  const hoyStr = hoy()
  const mañana = sumarDias(hoyStr, 1)
  const pasadoMañana = sumarDias(hoyStr, 2)
  const en3Semanas = sumarDias(hoyStr, 21)

  const cruz = profesores.get('Cruz')!
  const ramirez = profesores.get('Ramírez')!
  const torres = profesores.get('Torres')!

  async function crearBloque(
    profesor: typeof cruz,
    diaSemana: number,
    horaInicio: string,
    horaFin: string,
  ) {
    return prisma.bloqueAgenda.create({
      data: {
        profesorId: profesor.id,
        aulaId: profesor.aulaId,
        diaSemana,
        horaInicio: horaAMinutos(horaInicio),
        horaFin: horaAMinutos(horaFin),
        createdById: actor,
        updatedById: actor,
      },
    })
  }

  // Un bloque por cada fecha en la que va a haber un turno, con el día de la semana que le
  // corresponde a esa fecha (dominio.md: la fecha del turno coincide con el día del bloque).
  const bloqueHoy1 = await crearBloque(cruz, diaSemanaISO(hoyStr), '09:00', '10:00')
  const bloqueHoy2 = await crearBloque(cruz, diaSemanaISO(hoyStr), '10:00', '11:00')
  const bloqueHoyOtroProfesor = await crearBloque(ramirez, diaSemanaISO(hoyStr), '09:00', '10:00')
  const bloqueManana = await crearBloque(torres, diaSemanaISO(mañana), '11:00', '12:00')
  const bloquePasadoManana = await crearBloque(cruz, diaSemanaISO(pasadoMañana), '14:00', '15:00')
  const bloqueRango = await crearBloque(ramirez, diaSemanaISO(hoyStr), '16:00', '17:00')

  type DatosTurno = {
    bloqueAgendaId: number
    alumnoId: number
    materiaId: number
    fechaInicio: string
    fechaFin?: string
    estado?: 'ACTIVO' | 'CANCELADO'
    motivoConsulta?: string
  }
  async function crearTurno(datos: DatosTurno) {
    return prisma.turno.create({
      data: {
        bloqueAgendaId: datos.bloqueAgendaId,
        alumnoId: datos.alumnoId,
        materiaId: datos.materiaId,
        tipo:
          datos.fechaFin && datos.fechaFin !== datos.fechaInicio ? 'RECURRENTE' : 'SESION_UNICA',
        fechaInicio: fechaADate(datos.fechaInicio),
        fechaFin: fechaADate(datos.fechaFin ?? datos.fechaInicio),
        estado: datos.estado ?? 'ACTIVO',
        motivoConsulta: datos.motivoConsulta ?? null,
        createdById: actor,
        updatedById: actor,
      },
    })
  }

  // 1. Hoy, 09:00, Cruz/Matemática/Aula 1 — aparece en la agenda de hoy sin filtros.
  await crearTurno({
    bloqueAgendaId: bloqueHoy1.id,
    alumnoId: alumnos.get('Fernández')!,
    materiaId: cruz.materiaId,
    fechaInicio: hoyStr,
  })

  // 2. Hoy, 10:00, Cruz/Matemática/Aula 1, pero CANCELADO — no debe aparecer nunca.
  await crearTurno({
    bloqueAgendaId: bloqueHoy2.id,
    alumnoId: alumnos.get('Suárez')!,
    materiaId: cruz.materiaId,
    fechaInicio: hoyStr,
    estado: 'CANCELADO',
    motivoConsulta: 'Cancelado a propósito: no debe aparecer en la agenda.',
  })

  // 3. Hoy, 09:00 (misma hora que el 1, otro profesor) — prueba el orden "por hora y, dentro de
  //    la hora, por profesor" (Cruz antes que Ramírez, alfabético) y el filtro por aula/profesor.
  await crearTurno({
    bloqueAgendaId: bloqueHoyOtroProfesor.id,
    alumnoId: alumnos.get('Flores')!,
    materiaId: ramirez.materiaId,
    fechaInicio: hoyStr,
  })

  // 4. Mañana, Torres/Química/Aula 3 — prueba el filtro `fecha` (no aparece en la agenda de hoy).
  await crearTurno({
    bloqueAgendaId: bloqueManana.id,
    alumnoId: alumnos.get('Ibarra')!,
    materiaId: torres.materiaId,
    fechaInicio: mañana,
  })

  // 5. Pasado mañana, Cruz/Matemática/Aula 1 — otra fecha más para probar el filtro `fecha`.
  await crearTurno({
    bloqueAgendaId: bloquePasadoManana.id,
    alumnoId: alumnos.get('Fernández')!,
    materiaId: cruz.materiaId,
    fechaInicio: pasadoMañana,
  })

  // 6. "Rango" (fechaInicio distinta de fechaFin, tipo RECURRENTE): NINGÚN endpoint de este
  //    sprint crea un turno así (T-21 sólo crea SESION_UNICA, T-30). Está acá para ejercitar a
  //    mano la lectura genérica de `condicionTurnoEnFecha` (turnos.repository.ts): aparece hoy,
  //    y también si consultás `fecha` = hoy + 7 o + 14 días (la misma semana del día de hoy),
  //    pero no en un día de semana distinto ni después del 21/09 desde hoy.
  await crearTurno({
    bloqueAgendaId: bloqueRango.id,
    alumnoId: alumnos.get('Suárez')!,
    materiaId: ramirez.materiaId,
    fechaInicio: hoyStr,
    fechaFin: en3Semanas,
    motivoConsulta:
      'Turno de prueba con rango (no lo crea ninguna API todavía): ejercita la lectura genérica ' +
      'de condicionTurnoEnFecha. Aparece hoy y cada 7 días hasta ' +
      en3Semanas +
      '.',
  })

  console.log(`Datos de prueba listos para la agenda (hoy = ${hoyStr}):`)
  console.log(`  GET /api/v1/turnos/agenda                          → 3 turnos (hoy)`)
  console.log(`  GET /api/v1/turnos/agenda?fecha=${mañana}          → 1 turno (Torres, Química)`)
  console.log(
    `  GET /api/v1/turnos/agenda?fecha=${pasadoMañana}          → 1 turno (Cruz, Matemática)`,
  )
  console.log(
    `  GET /api/v1/turnos/agenda?materiaId=${cruz.materiaId}    → filtra por Matemática (hoy: 1)`,
  )
  console.log(
    `  GET /api/v1/turnos/agenda?aulaId=${ramirez.aulaId}       → filtra por Aula de Ramírez (hoy: 2)`,
  )
  console.log(
    `  GET /api/v1/turnos/agenda?profesorId=${ramirez.id}       → filtra por Ramírez (hoy: 2)`,
  )
  console.log(
    `  GET /api/v1/turnos/agenda?alumnoId=${alumnos.get('Suárez')}       → filtra por Suárez ` +
      '(hoy: 1; tiene un turno cancelado y uno con rango, el cancelado nunca aparece)',
  )
  console.log(
    `  GET /api/v1/turnos/agenda?fecha=${sumarDias(hoyStr, 7)} → el turno con rango, otra vez`,
  )
  console.log('El turno CANCELADO nunca debería aparecer, en ningún filtro.')
}

async function main() {
  await limpiar()
  if (!process.argv.includes('--limpiar')) await crear()
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
