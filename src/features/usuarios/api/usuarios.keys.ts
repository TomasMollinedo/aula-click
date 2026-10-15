// Todo cuelga de `all`: `useInvalidarUsuarios` alcanza a mi usuario.
export const usuariosKeys = {
  all: ['usuarios'] as const,
  miUsuario: () => [...usuariosKeys.all, 'mi-usuario'] as const,
}
