// Seed de desarrollo: roles, un usuario por rol, materias con precio, aulas, las tres formas de
// pago (con su tipo), una materia asignada al profesor, el historial del porcentaje del centro
// (HU-43) y un alumno de demo con acceso al portal (HU-27). Idempotente: todo es upsert por clave
// natural, salvo el porcentaje, que se carga sólo si la tabla está vacía.
//
// Se corre con `pnpm db:seed` (Prisma 7 no lo ejecuta solo después de `migrate dev`).
// Es la única excepción, fuera de los repositories, que usa Prisma directo (AGENTS.md, regla 3).
// No usa auth.api.signUpEmail: escribe Usuario + Account 'credential' con el hash de auth.ts.
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { env } from '@/config/env'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'
import { dateAFecha, fechaADate, hoy } from '@/server/shared/fechas'
import { upsertUsuario } from './seed-comun'

const ROLES = [
  {
    id: 'MESA_ENTRADAS',
    nombre: 'Mesa de entradas',
    descripcion: 'Gestiona alumnos, profesores, horarios, turnos y pagos; consulta las materias',
  },
  { id: 'PROFESOR', nombre: 'Profesor', descripcion: 'Consulta su agenda y sus alumnos' },
  {
    id: 'GERENTE',
    nombre: 'Gerente',
    descripcion: 'Administra el catálogo de materias y sus precios, y consulta el tablero',
  },
  { id: 'ALUMNO', nombre: 'Alumno', descripcion: 'Accede al portal del alumno' },
]

// Precio por hora de clase (HU-12, T-29): valores de ejemplo, en pesos.
const MATERIAS = [
  { nombre: 'Matemática', precioHora: '8000.00' },
  { nombre: 'Física', precioHora: '8000.00' },
  { nombre: 'Química', precioHora: '7500.00' },
  { nombre: 'Lengua', precioHora: '7000.00' },
  { nombre: 'Inglés', precioHora: '7500.00' },
  { nombre: 'Contabilidad', precioHora: '8500.00' },
]

// Formas de pago (HU-15, HU-23). Las reglas de cada medio se deciden por `tipoFormaPago`, no por el
// nombre. En una base del Sprint 2 la fila "Efectivo" ya existe sin tipo: el upsert por nombre se
// lo completa (la columna es nullable justamente para poder agregarla con la migración).
const FORMAS_PAGO = [
  { nombre: 'Efectivo', tipoFormaPago: 'EFECTIVO' },
  { nombre: 'Transferencia', tipoFormaPago: 'TRANSFERENCIA' },
  { nombre: 'Tarjeta de débito', tipoFormaPago: 'DEBITO' },
] as const

// Alumno de demo con acceso al portal (HU-27). Se puede cambiar con las variables SEED_ALUMNO_*
// de .env.example; si no están, se usan estos valores. Es adulto y tiene teléfono propio.
const ALUMNO_DEMO_POR_DEFECTO = {
  nombre: 'Lucía',
  apellido: 'López',
  dni: '45123456',
  telefono: '(387) 15-466-7788',
  fechaNacimiento: '2005-03-15',
}

// Dominio reservado (RFC 2606): no entrega correo. Better Auth exige un email, pero el alumno
// ingresa con su usuario (decisión T-70).
const DOMINIO_EMAIL_ALUMNOS = 'alumnos.aulaclick.invalid'

// Aulas: catálogo cargado por el seed, sin ABM en este release (HU-05, dominio.md → Aulas).
const AULAS = [
  { nombre: 'Aula 1', capacidad: 8 },
  { nombre: 'Aula 2', capacidad: 6 },
  { nombre: 'Aula 3', capacidad: 4 },
  { nombre: 'Aula 4', capacidad: 5 },
  { nombre: 'Aula 5', capacidad: 6 },
  { nombre: 'Aula 6', capacidad: 7 },
  { nombre: 'Aula 7', capacidad: 5 },
  { nombre: 'Aula 8', capacidad: 8 },
  { nombre: 'Aula 9', capacidad: 10 },
]

// Lee las credenciales del seed desde env y falla con un mensaje claro si falta alguna.
function credenciales() {
  const variables = {
    SEED_MESA_ENTRADAS_EMAIL: env.SEED_MESA_ENTRADAS_EMAIL,
    SEED_MESA_ENTRADAS_PASSWORD: env.SEED_MESA_ENTRADAS_PASSWORD,
    SEED_PROFESOR_EMAIL: env.SEED_PROFESOR_EMAIL,
    SEED_PROFESOR_PASSWORD: env.SEED_PROFESOR_PASSWORD,
    SEED_GERENTE_EMAIL: env.SEED_GERENTE_EMAIL,
    SEED_GERENTE_PASSWORD: env.SEED_GERENTE_PASSWORD,
  }
  const faltantes = Object.entries(variables)
    .filter(([, valor]) => !valor)
    .map(([nombre]) => `  - ${nombre}`)
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno para el seed (ver .env.example):\n${faltantes.join('\n')}`,
    )
  }
  return variables as { [K in keyof typeof variables]: string }
}

// Usuario del portal (HU-27): inicial del nombre + apellido + últimos 3 dígitos del DNI, en
// minúsculas, sin espacios ni tildes y con la "ñ" como "n". Juan Pérez, DNI 45123456 → "jperez456".
function usuarioDelAlumno(nombre: string, apellido: string, dni: string): string {
  const sinSimbolos = (texto: string) => normalizarBusqueda(texto).replace(/[^a-z0-9]/g, '')
  return `${sinSimbolos(nombre).charAt(0)}${sinSimbolos(apellido)}${dni.slice(-3)}`
}

// Si el usuario ya lo usa otra cuenta, se agrega un número al final ("jperez456-2").
async function usuarioLibre(base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidato = n === 1 ? base : `${base}-${n}`
    const ocupado = await prisma.usuario.findUnique({ where: { username: candidato } })
    if (!ocupado) return candidato
  }
}

// Alumno de demo + su cuenta del portal. La contraseña inicial es su DNI, y se re-hashea en cada
// corrida (igual que la de los otros usuarios del seed), con `contrasenaInicial: true`. El usuario
// no cambia una vez generado.
async function upsertAlumnoConAcceso(mesaId: string) {
  const datos = {
    nombre: env.SEED_ALUMNO_NOMBRE ?? ALUMNO_DEMO_POR_DEFECTO.nombre,
    apellido: env.SEED_ALUMNO_APELLIDO ?? ALUMNO_DEMO_POR_DEFECTO.apellido,
    dni: env.SEED_ALUMNO_DNI ?? ALUMNO_DEMO_POR_DEFECTO.dni,
    telefono: env.SEED_ALUMNO_TELEFONO ?? ALUMNO_DEMO_POR_DEFECTO.telefono,
  }
  const busqueda = normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`)

  const alumno = await prisma.alumno.upsert({
    where: { dni: datos.dni },
    create: {
      ...datos,
      busqueda,
      fechaNacimiento: fechaADate(ALUMNO_DEMO_POR_DEFECTO.fechaNacimiento),
      nivelEscolaridad: 'UNIVERSITARIO',
      createdById: mesaId,
      updatedById: mesaId,
    },
    update: {},
  })

  const perfil = {
    nombre: datos.nombre,
    apellido: datos.apellido,
    dni: datos.dni,
    busqueda,
    telefono: datos.telefono,
  }
  const existente = await prisma.usuario.findUnique({ where: { alumnoId: alumno.id } })
  const username =
    existente?.username ??
    (await usuarioLibre(usuarioDelAlumno(datos.nombre, datos.apellido, datos.dni)))
  const usuario = await prisma.usuario.upsert({
    where: { alumnoId: alumno.id },
    create: {
      id: randomUUID(),
      ...perfil,
      email: `${username}@${DOMINIO_EMAIL_ALUMNOS}`,
      emailVerified: true,
      username,
      displayUsername: username,
      role: 'ALUMNO',
      alumnoId: alumno.id,
      createdById: mesaId,
      updatedById: mesaId,
    },
    update: perfil,
  })

  const hash = await hashPassword(datos.dni)
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: usuario.id } },
    create: {
      id: randomUUID(),
      providerId: 'credential',
      accountId: usuario.id,
      userId: usuario.id,
      password: hash,
      contrasenaInicial: true,
    },
    update: { password: hash, contrasenaInicial: true },
  })

  return { alumno, username }
}

/** Día 1 del mes a `meses` del de hoy, a las 09:00 de Salta (UTC-3). */
function diaUnoDelMes(meses: number): Date {
  const [anio, mes] = hoy().split('-').map(Number) as [number, number]
  const primero = new Date(Date.UTC(anio, mes - 1 + meses, 1))
  return new Date(`${dateAFecha(primero)}T09:00:00-03:00`)
}

async function main() {
  const c = credenciales()

  for (const { id, nombre, descripcion } of ROLES) {
    await prisma.rol.upsert({
      where: { id },
      create: { id, nombre, descripcion },
      update: { nombre, descripcion },
    })
  }

  const mesa = await upsertUsuario({
    role: 'MESA_ENTRADAS',
    email: c.SEED_MESA_ENTRADAS_EMAIL,
    password: c.SEED_MESA_ENTRADAS_PASSWORD,
    nombre: 'Laura',
    apellido: 'Gómez',
    dni: '30111222',
    telefono: '(387) 15-411-1222',
  })

  const profesor = await upsertUsuario({
    role: 'PROFESOR',
    email: c.SEED_PROFESOR_EMAIL,
    password: c.SEED_PROFESOR_PASSWORD,
    nombre: 'Martín',
    apellido: 'Pérez',
    dni: '28333444',
    telefono: '(387) 15-433-3444',
  })
  const fichaProfesor = await prisma.profesor.upsert({
    where: { usuarioId: profesor.id },
    create: {
      usuarioId: profesor.id,
      titulo: 'Profesor en Matemática',
      matricula: 'MP-0001',
      capacidad: 5,
    },
    update: {},
  })

  const gerente = await upsertUsuario({
    role: 'GERENTE',
    email: c.SEED_GERENTE_EMAIL,
    password: c.SEED_GERENTE_PASSWORD,
    nombre: 'Ana',
    apellido: 'Rodríguez',
    dni: '25555666',
    telefono: '(387) 15-455-5666',
  })

  // Materias: alta del gerente (HU-12), siempre con precio. Si una ya existía sin precio (base
  // anterior a HU-12), se le carga el suyo y se reactiva: ninguna materia del seed queda sin precio.
  // Una que ya tiene precio no se toca (si el gerente le cambió el precio o la dio de baja, queda).
  let preciosCargados = 0
  for (const { nombre, precioHora } of MATERIAS) {
    const busqueda = normalizarBusqueda(nombre)
    await prisma.materia.upsert({
      where: { busqueda },
      create: { nombre, busqueda, precioHora, createdById: gerente.id, updatedById: gerente.id },
      update: {},
    })
    const { count } = await prisma.materia.updateMany({
      where: { busqueda, precioHora: null },
      data: { precioHora, estado: 'ACTIVO', updatedById: gerente.id },
    })
    preciosCargados += count
  }

  // El profesor del seed dicta Matemática (lo asigna mesa de entradas, HU-05): así se le puede
  // cargar horario y turnos sin preparar nada a mano. Si después se la quitaron, no se reasigna.
  const matematica = await prisma.materia.findUniqueOrThrow({
    where: { busqueda: normalizarBusqueda('Matemática') },
  })
  await prisma.asignacionMateria.upsert({
    where: { profesorId_materiaId: { profesorId: fichaProfesor.id, materiaId: matematica.id } },
    create: {
      profesorId: fichaProfesor.id,
      materiaId: matematica.id,
      createdById: mesa.id,
      updatedById: mesa.id,
    },
    update: {},
  })

  // Otras materias sin precio (cargadas a mano antes de HU-12): no se ofrecen hasta que el gerente
  // les cargue uno y las reactive. Lo hace el seed y no la migración (decisión T-50: migraciones
  // sólo generadas por Prisma).
  const sinPrecio = await prisma.materia.updateMany({
    where: { precioHora: null, estado: 'ACTIVO' },
    data: { estado: 'INACTIVO', updatedById: gerente.id },
  })

  for (const { nombre, capacidad } of AULAS) {
    await prisma.aula.upsert({
      where: { nombre },
      create: { nombre, capacidad },
      update: { capacidad },
    })
  }

  for (const { nombre, tipoFormaPago } of FORMAS_PAGO) {
    await prisma.formaPago.upsert({
      where: { nombre },
      create: { nombre, tipoFormaPago, createdById: gerente.id, updatedById: gerente.id },
      update: { tipoFormaPago },
    })
  }

  // Porcentaje del centro (HU-43): historial con dos filas, para que se vea el cambio y haya cobros
  // con porcentajes distintos. Sólo si la tabla está vacía: si el gerente ya lo cambió, no se toca.
  const porcentajesCargados = (await prisma.porcentajeCentro.count()) === 0
  if (porcentajesCargados) {
    await prisma.porcentajeCentro.createMany({
      data: [
        { porcentaje: '12.00', createdAt: diaUnoDelMes(-2), createdById: gerente.id },
        { porcentaje: '15.00', createdAt: diaUnoDelMes(-1), createdById: gerente.id },
      ],
    })
  }

  const { username: usuarioAlumno } = await upsertAlumnoConAcceso(mesa.id)

  console.log(
    `Seed completo: ${ROLES.length} roles, 3 usuarios, ${MATERIAS.length} materias ` +
      `(${preciosCargados} con precio recién cargado), Matemática asignada al profesor, ` +
      `${AULAS.length} aulas, ${FORMAS_PAGO.length} formas de pago, ` +
      `${porcentajesCargados ? 'el historial del porcentaje del centro (12 % y 15 %)' : 'el porcentaje del centro sin cambios'} ` +
      `y un alumno con acceso al ` +
      `portal (usuario "${usuarioAlumno}", contraseña inicial = su DNI); ` +
      `${sinPrecio.count} materia(s) sin precio pasadas a INACTIVO.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
