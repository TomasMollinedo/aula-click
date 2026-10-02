// Seed de PRUEBA para ejercitar la agenda diaria (`GET /api/v1/agendas/diaria`, T-23/T-57) a
// mano, con Swagger UI o Postman: un caso chico y predecible, con un resultado conocido para cada
// filtro. NO es el seed de desarrollo (`prisma/seed.ts`, que corre `pnpm db:seed`): este es un
// script aparte, pensado para correrse y volver a correrse las veces que haga falta.
//
// Requiere que el seed de desarrollo ya haya corrido (`pnpm db:seed`): reutiliza el usuario de
// mesa de entradas, las materias y las aulas que ese seed crea; no los duplica.
//
// Los datos que se ven en la app son verosímiles y no mencionan el seed. Lo carga `CARGADOR`: una
// usuaria de mesa de entradas **sin cuenta** (nadie puede iniciar sesión con ella), así que en la
// auditoría se ve como una persona más y ningún dato cargado desde la app queda a su nombre.
//
// Idempotente por "limpiar y recrear": cada corrida borra únicamente lo que creó `CARGADOR`
// (profesores y alumnos, y lo que dejó la versión anterior de este script, con emails
// `@agenda-demo.local`), con todo lo que cuelga de sus turnos (cancelaciones, pagos,
// finalizaciones, exámenes), y lo vuelve a crear con fechas relativas a "hoy", para que la agenda
// de hoy siempre tenga datos. Nunca toca los profesores, alumnos ni turnos que hayas cargado a
// mano, por la API o con otros seeds.
//
// Respeta las reglas de `docs/dominio.md`: lo carga mesa de entradas (`CARGADOR`); cada bloque es una hora en
// punto en un aula libre a esa hora (se leen los bloques que ya existen, de cualquier seed); la
// materia del turno está activa, con precio y asignada al profesor; una sesión única tiene "temas
// a trabajar" (HU-08); el recurrente tiene `serieId` (T-103); y la cancelación es una
// `CancelacionTurno` de esa ocurrencia (el turno sigue `ACTIVO`).
//
// Cómo correrlo:
//   pnpm exec tsx prisma/seed-agenda-demo.ts            crea (o recrea) los datos de prueba
//   pnpm exec tsx prisma/seed-agenda-demo.ts --limpiar   solo borra, no vuelve a crear nada
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, diaSemanaISO, fechaADate, hoy } from '@/server/shared/fechas'
import { horaAMinutos } from '@/server/shared/zod'

/** Dominio de la versión anterior de este script: se limpia por si quedó algo. */
const DOMINIO_ANTERIOR = 'agenda-demo.local'

/**
 * Usuaria de mesa de entradas que carga todo, sin cuenta (no puede iniciar sesión). Se busca por
 * DNI y no se borra nunca: lo que creó es lo que se limpia. `seed-pagos-demo.ts` usa su DNI para
 * encontrar a estos alumnos.
 */
const CARGADOR = {
  nombre: 'Marcela',
  apellido: 'Ruiz',
  dni: '32156093',
  email: 'marcela.ruiz@gmail.com',
  telefono: '(387) 15-468-9021',
}

/** Contraseña de los profesores (>= 8 caracteres, como exige Better Auth). Sólo desarrollo. */
const PASSWORD_DEMO = 'demo-1234'

// `aula` es la preferida: si a esa hora está ocupada (por ejemplo, por `seed-datos-demo.ts`), se
// usa otra libre.
const PROFESORES_DEMO = [
  {
    nombre: 'Valentina',
    apellido: 'Cruz',
    dni: '28640915',
    email: 'valentina.cruz@gmail.com',
    telefono: '(387) 15-441-5803',
    titulo: 'Profesora en Matemática (UNSa)',
    matricula: 'MP-3912',
    materia: 'Matemática',
    aula: 'Aula 1',
  },
  {
    nombre: 'Sofía',
    apellido: 'Ramírez',
    dni: '30217784',
    email: 'sofia.ramirez@hotmail.com',
    telefono: '(387) 15-527-1146',
    titulo: 'Licenciada en Física (UNSa)',
    matricula: 'MP-4205',
    materia: 'Física',
    aula: 'Aula 2',
  },
  {
    nombre: 'Diego',
    apellido: 'Torres',
    dni: '25983461',
    email: 'diego.torres@yahoo.com.ar',
    telefono: '(387) 15-489-3370',
    titulo: 'Ingeniero Químico (UNT)',
    matricula: 'MP-2874',
    materia: 'Química',
    aula: 'Aula 3',
  },
] as const

// Todos mayores de edad, con su email y su teléfono (dominio.md → Alumnos).
const ALUMNOS_DEMO = [
  {
    nombre: 'Julieta',
    apellido: 'Fernández',
    dni: '42871356',
    fechaNacimiento: '2001-03-12',
    email: 'juli.fernandez@gmail.com',
    telefono: '(387) 15-503-2291',
  },
  {
    nombre: 'Bruno',
    apellido: 'Suárez',
    dni: '42109874',
    fechaNacimiento: '1999-11-30',
    email: 'bruno.suarez99@hotmail.com',
    telefono: '(387) 15-466-7012',
  },
  {
    nombre: 'Camila',
    apellido: 'Flores',
    dni: '44652018',
    fechaNacimiento: '2003-07-08',
    email: 'cami.flores@gmail.com',
    telefono: '(387) 15-578-4430',
  },
  {
    nombre: 'Nicolás',
    apellido: 'Ibarra',
    dni: '42530697',
    fechaNacimiento: '2000-01-22',
    email: 'nico.ibarra@outlook.com',
    telefono: '(387) 15-412-8865',
  },
] as const

/** Busca por DNI (o crea) la usuaria de mesa de entradas que carga todo, sin cuenta. */
async function asegurarCargador() {
  return prisma.usuario.upsert({
    where: { dni: CARGADOR.dni },
    create: {
      id: randomUUID(),
      ...CARGADOR,
      busqueda: normalizarBusqueda(`${CARGADOR.apellido} ${CARGADOR.nombre} ${CARGADOR.dni}`),
      emailVerified: true,
      role: 'MESA_ENTRADAS',
    },
    update: {},
  })
}

/** `fecha` (YYYY-MM-DD) + `dias` (puede ser negativo), sin usar `new Date(string)` a mano. */
function sumarDias(fecha: string, dias: number): string {
  const unDiaMs = 24 * 60 * 60 * 1000
  return dateAFecha(new Date(fechaADate(fecha).getTime() + dias * unDiaMs))
}

/** Actor y catálogo que ya deja el seed de desarrollo. Falla con un mensaje claro si falta algo. */
async function requisitos() {
  // Mesa de entradas carga alumnos, horarios, asignaciones y turnos (no el gerente).
  const mesa = await asegurarCargador()
  // Sólo materias que se pueden asignar y cobrar: activas y con precio (HU-12).
  const materias = await prisma.materia.findMany({
    where: {
      busqueda: { in: PROFESORES_DEMO.map((p) => normalizarBusqueda(p.materia)) },
      estado: 'ACTIVO',
      precioHora: { not: null },
    },
  })
  const aulas = await prisma.aula.findMany({ where: { estado: 'ACTIVO' }, orderBy: { id: 'asc' } })

  if (!mesa || materias.length < PROFESORES_DEMO.length || aulas.length === 0) {
    throw new Error(
      'Faltan datos del seed de desarrollo (usuario de mesa de entradas, materias activas con ' +
        'precio o aulas). Corré primero `pnpm db:seed` y volvé a intentar.',
    )
  }

  const materiaPorNombre = new Map(materias.map((m) => [m.busqueda, m]))
  return { mesa, materiaPorNombre, aulas }
}

/**
 * Borra únicamente lo que creó `CARGADOR` (y lo de la versión anterior, `@agenda-demo.local`),
 * con todo lo que cuelga de sus turnos y alumnos: las FK son `onDelete: Restrict`, así que si
 * cancelaste o cobraste uno de sus turnos desde la app, sin esto la limpieza fallaría.
 */
async function limpiar() {
  const cargador = await prisma.usuario.findUnique({ where: { dni: CARGADOR.dni } })
  const delCargador = cargador ? [{ createdById: cargador.id }] : []
  const anterior = { email: { endsWith: `@${DOMINIO_ANTERIOR}` } }

  const usuarioIds = (
    await prisma.usuario.findMany({
      where: { OR: [...delCargador.map((c) => ({ ...c, role: 'PROFESOR' })), anterior] },
      select: { id: true },
    })
  ).map((u) => u.id)
  const profesorIds = (
    await prisma.profesor.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: { id: true },
    })
  ).map((p) => p.id)
  const alumnoIds = (
    await prisma.alumno.findMany({
      where: { OR: [...delCargador, anterior] },
      select: { id: true },
    })
  ).map((a) => a.id)
  const turnoIds = (
    await prisma.turno.findMany({
      where: {
        OR: [
          { bloqueAgenda: { profesorId: { in: profesorIds } } },
          { alumnoId: { in: alumnoIds } },
        ],
      },
      select: { id: true },
    })
  ).map((t) => t.id)
  const pagoIds = (
    await prisma.pago.findMany({ where: { alumnoId: { in: alumnoIds } }, select: { id: true } })
  ).map((p) => p.id)

  // Orden que respeta las FK: lo que cuelga de un turno o un pago, el turno y el pago, y después
  // asignaciones, bloques, profesores, cuentas y alumnos.
  await prisma.examen.deleteMany({ where: { alumnoId: { in: alumnoIds } } })
  await prisma.pagoTurno.deleteMany({
    where: { OR: [{ turnoId: { in: turnoIds } }, { pagoId: { in: pagoIds } }] },
  })
  await prisma.pago.deleteMany({ where: { id: { in: pagoIds } } })
  await prisma.cancelacionTurno.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.finalizacionRecurrencia.deleteMany({ where: { turnoId: { in: turnoIds } } })
  await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } })
  await prisma.asignacionMateria.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.bloqueAgenda.deleteMany({ where: { profesorId: { in: profesorIds } } })
  await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } })
  await prisma.session.deleteMany({ where: { userId: { in: usuarioIds } } })
  await prisma.account.deleteMany({ where: { userId: { in: usuarioIds } } })
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } })
  await prisma.alumno.deleteMany({ where: { id: { in: alumnoIds } } })

  console.log(
    `Limpieza: ${profesorIds.length} profesores, ${alumnoIds.length} alumnos y sus bloques/turnos.`,
  )
}

async function crear() {
  const { mesa, materiaPorNombre, aulas } = await requisitos()
  const auditoria = { createdById: mesa.id, updatedById: mesa.id }
  const hash = await hashPassword(PASSWORD_DEMO)

  // --- Profesores demo, con su cuenta (pueden entrar a "Mi agenda") y su materia asignada
  // (dominio.md: la materia del turno debe estar asignada al profesor del bloque) ---
  const profesores = new Map<
    string,
    { id: number; materiaId: number; aulaPreferida: string; apellido: string }
  >()
  for (const datos of PROFESORES_DEMO) {
    const materia = materiaPorNombre.get(normalizarBusqueda(datos.materia))!
    const usuario = await prisma.usuario.create({
      data: {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
        telefono: datos.telefono,
        email: datos.email,
        emailVerified: true,
        role: 'PROFESOR',
        // Los da de alta mesa de entradas (T-22): es lo que identifica qué limpiar.
        createdById: mesa.id,
        updatedById: mesa.id,
      },
    })
    // Cada profesor tiene su cuenta (dominio.md → Roles): Account 'credential' con el hash de auth.ts.
    await prisma.account.create({
      data: {
        id: randomUUID(),
        providerId: 'credential',
        accountId: usuario.id,
        userId: usuario.id,
        password: hash,
      },
    })
    const profesor = await prisma.profesor.create({
      data: {
        usuarioId: usuario.id,
        titulo: datos.titulo,
        matricula: datos.matricula,
        capacidad: 5,
      },
    })
    await prisma.asignacionMateria.create({
      data: { profesorId: profesor.id, materiaId: materia.id, ...auditoria },
    })
    profesores.set(datos.apellido, {
      id: profesor.id,
      materiaId: materia.id,
      aulaPreferida: datos.aula,
      apellido: datos.apellido,
    })
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
        telefono: datos.telefono,
        email: datos.email,
        nivelEscolaridad: 'UNIVERSITARIO',
        institucionEducativa: 'Universidad Nacional de Salta',
        ...auditoria,
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

  // Un aula no puede tener dos bloques activos a la misma hora el mismo día (dominio.md → Bloques):
  // se parte de los bloques que ya hay en la base y se suman los que se crean acá.
  const aulaOcupada = new Set(
    (
      await prisma.bloqueAgenda.findMany({
        where: { estado: 'ACTIVO' },
        select: { aulaId: true, diaSemana: true, horaInicio: true },
      })
    ).map((b) => `${b.aulaId}|${b.diaSemana}|${b.horaInicio}`),
  )

  async function crearBloque(
    profesor: typeof cruz,
    diaSemana: number,
    horaInicio: string,
    horaFin: string,
  ) {
    const inicio = horaAMinutos(horaInicio)
    const libre = (aulaId: number) => !aulaOcupada.has(`${aulaId}|${diaSemana}|${inicio}`)
    const preferida = aulas.find((a) => a.nombre === profesor.aulaPreferida)
    const aula = preferida && libre(preferida.id) ? preferida : aulas.find((a) => libre(a.id))
    if (!aula) {
      throw new Error(
        `No hay ningún aula libre el día ${diaSemana} a las ${horaInicio} para ${profesor.apellido}.`,
      )
    }
    aulaOcupada.add(`${aula.id}|${diaSemana}|${inicio}`)
    return prisma.bloqueAgenda.create({
      data: {
        profesorId: profesor.id,
        aulaId: aula.id,
        diaSemana,
        horaInicio: inicio,
        horaFin: horaAMinutos(horaFin),
        ...auditoria,
      },
    })
  }

  // Un bloque (una hora en punto) por cada fecha en la que va a haber un turno, con el día de la
  // semana que le corresponde a esa fecha (dominio.md: la fecha del turno coincide con el día del
  // bloque).
  const bloqueHoy1 = await crearBloque(cruz, diaSemanaISO(hoyStr), '09:00', '10:00')
  const bloqueHoy2 = await crearBloque(cruz, diaSemanaISO(hoyStr), '10:00', '11:00')
  const bloqueHoyOtroProfesor = await crearBloque(ramirez, diaSemanaISO(hoyStr), '09:00', '10:00')
  const bloqueManana = await crearBloque(torres, diaSemanaISO(mañana), '11:00', '12:00')
  const bloquePasadoManana = await crearBloque(cruz, diaSemanaISO(pasadoMañana), '14:00', '15:00')
  const bloqueRecurrente = await crearBloque(ramirez, diaSemanaISO(hoyStr), '16:00', '17:00')

  type DatosTurno = {
    bloqueAgendaId: number
    alumnoId: number
    materiaId: number
    fechaInicio: string
    fechaFin?: string
    observaciones?: string
    temas?: string
  }
  async function crearTurno(datos: DatosTurno) {
    const recurrente = datos.fechaFin !== undefined && datos.fechaFin !== datos.fechaInicio
    return prisma.turno.create({
      data: {
        bloqueAgendaId: datos.bloqueAgendaId,
        alumnoId: datos.alumnoId,
        materiaId: datos.materiaId,
        tipo: recurrente ? 'RECURRENTE' : 'SESION_UNICA',
        fechaInicio: fechaADate(datos.fechaInicio),
        fechaFin: fechaADate(datos.fechaFin ?? datos.fechaInicio),
        observaciones: datos.observaciones ?? null,
        // "Temas a trabajar" (HU-08): obligatorio en una sesión única, opcional en un recurrente.
        temas: datos.temas ?? (recurrente ? null : 'Repaso general de la unidad'),
        // Todo alta recurrente es una serie (decisión T-103); una sesión única no tiene.
        serieId: recurrente ? randomUUID() : null,
        ...auditoria,
      },
    })
  }

  // 1. Hoy, 09:00, Cruz/Matemática — aparece en la agenda de hoy como "Agendado".
  await crearTurno({
    bloqueAgendaId: bloqueHoy1.id,
    alumnoId: alumnos.get('Fernández')!,
    materiaId: cruz.materiaId,
    fechaInicio: hoyStr,
    temas: 'Ecuaciones de segundo grado',
  })

  // 2. Hoy, 10:00, Cruz/Matemática, con la ocurrencia CANCELADA: desde el Sprint 2 se registra una
  //    CancelacionTurno de esa fecha y el turno sigue ACTIVO (HU-13). La agenda la muestra con
  //    estado "Cancelado" y sin prioridad; con `estado=AGENDADO` no aparece.
  const cancelado = await crearTurno({
    bloqueAgendaId: bloqueHoy2.id,
    alumnoId: alumnos.get('Suárez')!,
    materiaId: cruz.materiaId,
    fechaInicio: hoyStr,
    observaciones: 'Prepara el recuperatorio de Análisis I.',
  })
  await prisma.cancelacionTurno.create({
    data: {
      turnoId: cancelado.id,
      fechaOcurrencia: fechaADate(hoyStr),
      motivo: 'CANCELACION_ALUMNO',
      detalle: 'Avisó por WhatsApp que está enfermo.',
      createdById: mesa.id,
    },
  })

  // 3. Hoy, 09:00 (misma hora que el 1, otro profesor) — prueba el orden "por hora y, dentro de
  //    la hora, por profesor" (Cruz antes que Ramírez, alfabético) y el filtro por aula/profesor.
  await crearTurno({
    bloqueAgendaId: bloqueHoyOtroProfesor.id,
    alumnoId: alumnos.get('Flores')!,
    materiaId: ramirez.materiaId,
    fechaInicio: hoyStr,
  })

  // 4. Mañana, Torres/Química — prueba el filtro `fecha` (no aparece en la agenda de hoy).
  await crearTurno({
    bloqueAgendaId: bloqueManana.id,
    alumnoId: alumnos.get('Ibarra')!,
    materiaId: torres.materiaId,
    fechaInicio: mañana,
  })

  // 5. Pasado mañana, Cruz/Matemática — otra fecha más para probar el filtro `fecha`.
  await crearTurno({
    bloqueAgendaId: bloquePasadoManana.id,
    alumnoId: alumnos.get('Fernández')!,
    materiaId: cruz.materiaId,
    fechaInicio: pasadoMañana,
  })

  // 6. Recurrente semanal de hoy a hoy + 21 (cuatro ocurrencias, con `serieId`): aparece hoy y
  //    también con `fecha` = hoy + 7, + 14 o + 21; no en otro día de la semana ni después.
  await crearTurno({
    bloqueAgendaId: bloqueRecurrente.id,
    alumnoId: alumnos.get('Suárez')!,
    materiaId: ramirez.materiaId,
    fechaInicio: hoyStr,
    fechaFin: en3Semanas,
    observaciones: 'Apoyo semanal hasta el parcial de Física I.',
  })

  // Resultados esperados (la agenda incluye las canceladas, con su estado).
  const enAulaDeRamirez = [bloqueHoy1, bloqueHoy2, bloqueHoyOtroProfesor, bloqueRecurrente].filter(
    (b) => b.aulaId === bloqueHoyOtroProfesor.aulaId,
  ).length
  const url = '/api/v1/agendas/diaria'
  console.log(`Datos de prueba listos para la agenda diaria (hoy = ${hoyStr}):`)
  console.log(`  GET ${url}                       → 4 ocurrencias (1 cancelada)`)
  console.log(`  GET ${url}?estado=AGENDADO       → 3 (sin la cancelada)`)
  console.log(`  GET ${url}?fecha=${mañana}       → 1 (Torres, Química)`)
  console.log(`  GET ${url}?fecha=${pasadoMañana}       → 1 (Cruz, Matemática)`)
  console.log(`  GET ${url}?materiaId=${cruz.materiaId}    → Matemática: 2 hoy (una cancelada)`)
  console.log(
    `  GET ${url}?aulaId=${bloqueHoyOtroProfesor.aulaId}       → ${enAulaDeRamirez} hoy en esa aula`,
  )
  console.log(`  GET ${url}?q=ramirez             → por nombre de profesor: 2 (Ramírez)`)
  console.log(`  GET ${url}?q=suarez              → por nombre de alumno: 2 (una cancelada)`)
  console.log(`  GET ${url}?profesorId=${ramirez.id}      → vista personal de Ramírez: 2`)
  console.log(
    `  GET ${url}?profesorId=${ramirez.id}&q=cruz → vacío: con profesorId, q sólo busca alumnos`,
  )
  console.log(`  GET ${url}?fecha=${sumarDias(hoyStr, 7)} → el recurrente, otra vez`)
  console.log(`Los profesores entran con su email y la contraseña "${PASSWORD_DEMO}".`)
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
