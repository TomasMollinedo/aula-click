// Seed de desarrollo: roles, un usuario por rol (salvo ALUMNO, que llega con el portal en el
// Sprint 3) y materias de ejemplo. Idempotente: todo es upsert por clave natural.
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

const ROLES = [
  {
    id: 'MESA_ENTRADAS',
    nombre: 'Mesa de entradas',
    descripcion: 'Gestiona alumnos, profesores, materias y turnos',
  },
  { id: 'PROFESOR', nombre: 'Profesor', descripcion: 'Consulta su agenda y sus alumnos' },
  { id: 'GERENTE', nombre: 'Gerente', descripcion: 'Crea los usuarios y consulta indicadores' },
  { id: 'ALUMNO', nombre: 'Alumno', descripcion: 'Accede al portal del alumno' },
  { id: 'ADMIN', nombre: 'Administrador', descripcion: 'Acceso completo al sistema' },
]

const MATERIAS = ['Matemática', 'Física', 'Química', 'Lengua', 'Inglés', 'Contabilidad']

type UsuarioSeed = {
  role: string
  email: string
  password: string
  nombre: string
  apellido: string
  dni: string
  telefono: string
}

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

async function upsertUsuario(datos: UsuarioSeed) {
  const { email, password, ...resto } = datos
  const perfil = {
    ...resto,
    busqueda: normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`),
  }
  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { id: randomUUID(), email, emailVerified: true, ...perfil },
    update: perfil,
  })

  // La contraseña vive en Account (providerId 'credential', accountId = id del usuario),
  // que es donde la busca Better Auth en el login. Se re-hashea en cada corrida.
  const hash = await hashPassword(password)
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: usuario.id } },
    create: {
      id: randomUUID(),
      providerId: 'credential',
      accountId: usuario.id,
      userId: usuario.id,
      password: hash,
    },
    update: { password: hash },
  })

  return usuario
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

  await upsertUsuario({
    role: 'MESA_ENTRADAS',
    email: c.SEED_MESA_ENTRADAS_EMAIL,
    password: c.SEED_MESA_ENTRADAS_PASSWORD,
    nombre: 'Laura',
    apellido: 'Gómez',
    dni: '30111222',
    telefono: '387 4111222',
  })

  const profesor = await upsertUsuario({
    role: 'PROFESOR',
    email: c.SEED_PROFESOR_EMAIL,
    password: c.SEED_PROFESOR_PASSWORD,
    nombre: 'Martín',
    apellido: 'Pérez',
    dni: '28333444',
    telefono: '387 4333444',
  })
  await prisma.profesor.upsert({
    where: { usuarioId: profesor.id },
    create: { usuarioId: profesor.id, titulo: 'Profesor en Matemática', matricula: 'MP-0001' },
    update: {},
  })

  const gerente = await upsertUsuario({
    role: 'GERENTE',
    email: c.SEED_GERENTE_EMAIL,
    password: c.SEED_GERENTE_PASSWORD,
    nombre: 'Ana',
    apellido: 'Rodríguez',
    dni: '25555666',
    telefono: '387 4555666',
  })

  for (const nombre of MATERIAS) {
    const busqueda = normalizarBusqueda(nombre)
    await prisma.materia.upsert({
      where: { busqueda },
      create: { nombre, busqueda, createdById: gerente.id, updatedById: gerente.id },
      update: {},
    })
  }

  console.log(`Seed completo: ${ROLES.length} roles, 3 usuarios y ${MATERIAS.length} materias.`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
