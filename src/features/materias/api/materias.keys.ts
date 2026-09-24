export const materiasKeys = {
  all: ['materias'] as const,
  selector: () => [...materiasKeys.all, 'selector'] as const,
}
