import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, usernameClient } from 'better-auth/client/plugins'

// Los campos extra de Usuario se redeclaran acá porque el frontend no puede importar la instancia
// del servidor (@/lib/auth, ESLint): si cambian en src/lib/auth.ts, se cambian acá en el mismo PR.
// `busqueda` queda afuera a propósito: en el servidor tiene `returned: false`, así que nunca llega
// al cliente y declararla solo agregaría un campo que la sesión no trae.
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: 'string' },
        apellido: { type: 'string' },
        dni: { type: 'string' },
        telefono: { type: 'string' },
        estado: { type: 'string' },
      },
    }),
    // Ingreso del alumno con su usuario (HU-28, T-75): authClient.signIn.username.
    usernameClient(),
  ],
})
