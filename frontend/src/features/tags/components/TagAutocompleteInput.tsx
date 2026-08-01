import { useId, useMemo, useState } from 'react'
import { useTagSuggestions } from '../hooks'
import type { TagOption } from '../types'

interface TagAutocompleteInputProps {
  id: string
  value: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  onChange: (value: string) => void
  onBlur: () => void
}

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function selectedTagNames(value: string): string[] {
  return value
    .split(',')
    .map(normalizeTagName)
    .filter(Boolean)
}

export function TagAutocompleteInput({
  id,
  value,
  disabled = false,
  invalid = false,
  describedBy,
  onChange,
  onBlur,
}: TagAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const listboxId = useId()
  const segments = value.split(',')
  const activeSearch = normalizeTagName(segments.at(-1) ?? '')
  const selectedNames = useMemo(() => selectedTagNames(value), [value])
  const selectedKeys = useMemo(
    () => new Set(selectedNames.map((name) => name.toLocaleLowerCase('pt-BR'))),
    [selectedNames],
  )
  const suggestionsQuery = useTagSuggestions(activeSearch, isOpen && !disabled)
  const suggestions = (suggestionsQuery.data ?? []).filter(
    (tag) => !selectedKeys.has(tag.name.toLocaleLowerCase('pt-BR')),
  )

  const selectSuggestion = (tag: TagOption) => {
    const previousSegments = segments.slice(0, -1)
    const nextTags = [...previousSegments, tag.name]
      .map(normalizeTagName)
      .filter(Boolean)

    onChange(`${nextTags.join(', ')}, `)
    setIsOpen(true)
  }

  return (
    <div className="tag-autocomplete">
      <input
        id={id}
        value={value}
        disabled={disabled}
        placeholder="frontend, urgente, revisão"
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        role="combobox"
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          onBlur()
          window.setTimeout(() => setIsOpen(false), 100)
        }}
        onChange={(event) => onChange(event.target.value)}
      />

      {isOpen ? (
        <div className="tag-suggestions" id={listboxId} role="listbox">
          {suggestionsQuery.isPending ? (
            <span className="tag-suggestions-state">Buscando tags…</span>
          ) : suggestionsQuery.isError ? (
            <span className="tag-suggestions-state">
              Não foi possível carregar sugestões.
            </span>
          ) : suggestions.length > 0 ? (
            suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(tag)}
              >
                {tag.name}
              </button>
            ))
          ) : (
            <span className="tag-suggestions-state">
              {activeSearch
                ? 'Nenhuma tag existente. O novo nome será criado ao salvar.'
                : 'Digite para buscar ou crie uma nova tag.'}
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}