import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

// Solo redirige a /login si no hay sesión. Nunca decide roles: la autorización vive en la API.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/alumnos/:path*', '/profesores/:path*', '/materias/:path*', '/turnos/:path*'],
}
