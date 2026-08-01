import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TagAutocompleteInput } from './TagAutocompleteInput'

function ControlledTagInput() {
  const [value, setValue] = useState('')

  return (
    <>
      <label htmlFor="tags">Tags</label>
      <TagAutocompleteInput
        id="tags"
        value={value}
        onChange={setValue}
        onBlur={() => undefined}
      />
    </>
  )
}

function renderInput() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledTagInput />
    </QueryClientProvider>,
  )
}

describe('TagAutocompleteInput', () => {
  it('loads existing tags and inserts the selected suggestion', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)

      if (url.includes('/tags?')) {
        return new Response(
          JSON.stringify([
            {
              id: 'tag-1',
              name: 'frontend',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Requisição não simulada: ${url}`)
    })

    renderInput()

    const input = screen.getByRole('combobox', { name: 'Tags' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'front' } })

    fireEvent.mouseDown(
      await screen.findByRole('option', { name: 'frontend' }),
    )
    fireEvent.click(screen.getByRole('option', { name: 'frontend' }))

    expect(input).toHaveValue('frontend, ')
  })
})