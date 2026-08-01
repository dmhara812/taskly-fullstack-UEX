import { useQuery } from '@tanstack/react-query'
import { listTags } from './api'

export const tagKeys = {
  all: ['tags'] as const,
  list: (search?: string) => [...tagKeys.all, 'list', search ?? ''] as const,
}

export function useTagSuggestions(search: string, enabled: boolean) {
  const normalizedSearch = search.trim()

  return useQuery({
    queryKey: tagKeys.list(normalizedSearch || undefined),
    queryFn: () => listTags(normalizedSearch || undefined),
    enabled,
    staleTime: 60_000,
  })
}