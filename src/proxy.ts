import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

// Solo redirige a /login si no hay cookie de sesión (presencia, no validez). Nunca decide roles:
// la autorización vive en la API.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

// Matcher negativo (decisión T-14): corre en todo salvo /login, /api/*, los internos de Next
// (/_next/static, /_next/image) y los archivos estáticos (cualquier ruta con un punto, como
// /favicon.ico). `login` y `api` van delimitados para no excluir /loginx ni /apix.
// Lo prueba src/__tests__/proxy.test.ts. Tiene que ser un literal: Next lo analiza en el build.
export const config = {
  matcher: ['/((?!login(?:/|$)|api(?:/|$)|_next/static|_next/image|.*\\..*).*)'],
}
