import { apiRequest } from '../../api/client'
import type { TagOption } from './types'

export function listTags(search?: string): Promise<TagOption[]> {
  const params = new URLSearchParams({ limit: '50' })

  if (search) {
    params.set('search', search)
  }

  return apiRequest<TagOption[]>(`/tags?${params.toString()}`)
}