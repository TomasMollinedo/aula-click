import { Search, X } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

/** Input de búsqueda con lupa y botón para limpiar el texto. */
function SearchInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <div data-slot="search-input" className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Limpiar búsqueda"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-2"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export { SearchInput }
