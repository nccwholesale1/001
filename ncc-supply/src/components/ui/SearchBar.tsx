import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TypeaheadResult } from '../../server/integrations/shopify/types'
import { Icon } from './Icon'

export interface SearchBarProps {
  initialQuery?: string
  onSuggest: (query: string) => Promise<TypeaheadResult>
}

const DEBOUNCE_MS = 200
const MIN_QUERY_LENGTH = 2

/**
 * Design system §5.2 "SearchBar — global header search with typeahead
 * suggestions (products + collections), used on /search". A real <form
 * method="get" action="/search"> so full-text search works with zero
 * client JS (progressive enhancement); the dropdown below it is a
 * client-side-only convenience layered on top.
 */
export function SearchBar({ initialQuery = '', onSuggest }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<TypeaheadResult | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([])

  const flatOptions = suggestions
    ? [
        ...suggestions.collections.map((c) => ({ kind: 'collection' as const, ...c })),
        ...suggestions.products.map((p) => ({ kind: 'product' as const, ...p })),
      ]
    : []

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) return
    let cancelled = false
    const timeout = setTimeout(async () => {
      const result = await onSuggest(query.trim())
      if (!cancelled) {
        setSuggestions(result)
        setOpen(result.products.length > 0 || result.collections.length > 0)
        setActiveIndex(-1)
      }
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, onSuggest])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || flatOptions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % flatOptions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? flatOptions.length - 1 : index - 1))
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      // Trigger a real click on the anchor rather than setting
      // window.location — that's the standard, more compatible way to
      // "activate" a link programmatically, and keeps the actual <a href>
      // as the single source of truth for the destination URL.
      optionRefs.current[activeIndex]?.click()
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <form method="get" action="/search" role="search">
        <label className="relative block">
          <span className="sr-only">Search the catalogue</span>
          <Icon
            icon={Search}
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => flatOptions.length > 0 && setOpen(true)}
            placeholder="Search products and categories…"
            role="combobox"
            aria-expanded={open}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            className="w-full rounded-lg border border-input bg-card py-2.5 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </form>

      {open && query.trim().length >= MIN_QUERY_LENGTH ? (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lift"
        >
          {flatOptions.map((option, index) => (
            <li
              key={`${option.kind}-${'sku' in option ? option.sku : option.slug}`}
              role="option"
              aria-selected={index === activeIndex}
            >
              <a
                ref={(el) => {
                  optionRefs.current[index] = el
                }}
                href={
                  option.kind === 'product' ? `/product/${option.sku}` : `/category/${option.slug}`
                }
                className={
                  index === activeIndex
                    ? 'block bg-secondary px-3 py-2 text-sm text-foreground'
                    : 'block px-3 py-2 text-sm text-foreground hover:bg-secondary'
                }
              >
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {option.kind === 'product' ? 'Product' : 'Category'}
                </span>
                <span className="block">{option.title}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
