import { apiRequest } from '../../api/client'
import type {
  CurrentUserResponse,
  LoginCredentials,
  RegisterPayload,
  TokenResponse,
  User,
} from './types'

export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const formData = new URLSearchParams()
  formData.set('username', credentials.email)
  formData.set('password', credentials.password)

  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    authenticated: false,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })
}

export async function register(payload: RegisterPayload): Promise<User> {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    authenticated: false,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiRequest<CurrentUserResponse>('/auth/me')
  return response.user
}