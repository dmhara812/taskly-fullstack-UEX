export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskTag {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  name: string
  url: string
  content_type: string
  size_bytes: number
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  short_description: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  tags: TaskTag[]
  attachments: TaskAttachment[]
  created_at: string
  updated_at: string
}

export interface PaginatedTasks {
  items: Task[]
  total: number
  page: number
  size: number
  pages: number
}

export interface TaskBoardFilters {
  projectId: string
  priority?: TaskPriority
  search?: string
}

export interface TaskFilters {
  projectId: string
  page: number
  size: number
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
}

export interface TaskCreatePayload {
  project_id: string
  title: string
  short_description: string
  description: string | null
  priority: TaskPriority
  due_at: string | null
  tags: string[]
}

export interface TaskUpdatePayload {
  title?: string
  short_description?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  due_at?: string | null
  tags?: string[]
}

export interface TaskFormSubmission {
  title: string
  short_description: string
  description: string | null
  priority: TaskPriority
  due_at: string | null
  tags: string[]
  status?: TaskStatus
}
