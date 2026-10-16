// Lo que comparten los seeds de desarrollo (`seed.ts` y `seed-liquidaciones.ts`). Sin efectos al
// importarlo: cada seed arma su propio `main()`.
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarBusqueda } from '@/server/shared/busqueda'

export type UsuarioSeed = {
  role: string
  email: string
  password: string
  nombre: string
  apellido: string
  dni: string
  telefono: string
}

export async function upsertUsuario(datos: UsuarioSeed) {
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
