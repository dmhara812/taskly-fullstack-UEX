export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface PaginatedProjects {
  items: Project[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ProjectFilters {
  page: number
  size: number
  status: ProjectStatus
  search?: string
}

export interface ProjectPayload {
  name: string
  description: string | null
}

export interface ProjectUpdatePayload {
  name?: string
  description?: string | null
  status?: ProjectStatus
}