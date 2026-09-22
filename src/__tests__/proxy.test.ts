import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { config, proxy } from '../proxy'

// En Next 16.3.5 la utilidad se llama unstable_doesMiddlewareMatch (la doc menciona
// unstable_doesProxyMatch, que no existe en esta versión).
const corre = (url: string) => unstable_doesMiddlewareMatch({ config, url })

describe('matcher de proxy.ts', () => {
  it.each(['/', '/mesa', '/mesa/alumnos', '/mesa/alumnos/12', '/profesor', '/loginx', '/apix'])(
    'protege %s',
    (url) => {
      expect(corre(url)).toBe(true)
    },
  )

  it.each([
    '/login',
    '/login/',
    '/api/v1/alumnos',
    '/api/v1/docs',
    '/api/auth/get-session',
    '/_next/static/chunks/x.js',
    '/_next/image',
    '/favicon.ico',
    '/logo.svg',
  ])('no corre en %s', (url) => {
    expect(corre(url)).toBe(false)
  })
})

describe('proxy', () => {
  it('sin cookie de sesión redirige a /login', () => {
    const respuesta = proxy(new NextRequest('http://localhost:3000/mesa/alumnos'))
    expect(getRedirectUrl(respuesta)).toBe('http://localhost:3000/login')
  })

  it('con cookie de sesión deja pasar', () => {
    const request = new NextRequest('http://localhost:3000/mesa/alumnos', {
      headers: { cookie: 'better-auth.session_token=abc.def' },
    })
    expect(getRedirectUrl(proxy(request))).toBeNull()
  })
})
