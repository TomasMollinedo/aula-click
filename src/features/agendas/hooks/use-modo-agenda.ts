'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { useUsuarioId } from '@/features/auth/hooks/use-usuario-id'

import { claveModoAgenda, MODO_POR_DEFECTO, type ModoAgenda, parsearModo } from '../modo-agenda'

// Lo elegido en esta sesión de la pestaña, por si `localStorage` no está disponible (ventana
// privada, datos del sitio bloqueados): el selector sigue andando, solo que no se recuerda.
const enMemoria = new Map<string, ModoAgenda>()
const oyentes = new Set<() => void>()

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  window.addEventListener('storage', avisar)
  return () => {
    oyentes.delete(avisar)
    window.removeEventListener('storage', avisar)
  }
}

function leer(clave: string): ModoAgenda {
  const enSesion = enMemoria.get(clave)
  if (enSesion) return enSesion
  try {
    return parsearModo(window.localStorage.getItem(clave))
  } catch {
    return MODO_POR_DEFECTO
  }
}

function guardar(clave: string, modo: ModoAgenda) {
  enMemoria.set(clave, modo)
  try {
    window.localStorage.setItem(clave, modo)
  } catch {
    // Sin storage se usa solo la memoria de la pestaña.
  }
  oyentes.forEach((avisar) => avisar())
}

/**
 * Modo de la agenda (calendario o lista) y cómo cambiarlo. Recuerda la última elección **por
 * usuario** en `localStorage` (la clave lleva el id del usuario). Antes de conocer al usuario, o si
 * el navegador no deja guardar, vale la lista y el cambio dura lo que la pestaña.
 */
export function useModoAgenda() {
  const usuarioId = useUsuarioId()
  const clave = claveModoAgenda(usuarioId ?? 'sin-sesion')

  const modo = useSyncExternalStore(
    suscribir,
    () => (usuarioId ? leer(clave) : (enMemoria.get(clave) ?? MODO_POR_DEFECTO)),
    () => MODO_POR_DEFECTO,
  )

  const cambiarModo = useCallback(
    (nuevo: ModoAgenda) => {
      if (usuarioId) guardar(clave, nuevo)
      else {
        enMemoria.set(clave, nuevo)
        oyentes.forEach((avisar) => avisar())
      }
    },
    [clave, usuarioId],
  )

  return { modo, cambiarModo }
}
