export interface User {
  id: string
  name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload extends LoginCredentials {
  name: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string | null
  token_type: string
}

export interface CurrentUserResponse {
  user: User
}