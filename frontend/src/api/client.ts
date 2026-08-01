import {
  clearAuthTokens,
  readAuthTokens,
  writeAuthTokens,
} from '../lib/auth-storage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const AUTH_EXPIRED_DETAIL = 'Invalid or expired token'

let refreshInFlight: Promise<boolean> | null = null

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
  retryAfterRefresh?: boolean
}

interface ErrorPayload {
  detail?: string | Array<{ msg?: string }>
}

interface RefreshResponse {
  access_token: string
  refresh_token: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function normalizeErrorDetail(payload: ErrorPayload | null): string {
  if (!payload?.detail) {
    return 'Não foi possível concluir a solicitação.'
  }

  if (typeof payload.detail === 'string') {
    return payload.detail
  }

  return payload.detail
    .map((item) => item.msg)
    .filter((message): message is string => Boolean(message))
    .join(' ')
}

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return (await response.clone().json()) as ErrorPayload
  } catch {
    return null
  }
}

function buildHeaders(
  headers: HeadersInit | undefined,
  authenticated: boolean,
): Headers {
  const result = new Headers(headers)

  if (!result.has('Accept')) {
    result.set('Accept', 'application/json')
  }

  const tokens = readAuthTokens()
  if (authenticated && tokens) {
    result.set('Authorization', `Bearer ${tokens.accessToken}`)
  }

  return result
}

async function executeRefresh(): Promise<boolean> {
  const tokens = readAuthTokens()

  if (!tokens?.refreshToken) {
    return false
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  })

  if (!response.ok) {
    clearAuthTokens()
    return false
  }

  const payload = (await response.json()) as RefreshResponse

  if (!payload.refresh_token) {
    clearAuthTokens()
    return false
  }

  writeAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  })
  return true
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    // Uma única renovação atende requisições concorrentes que falharam com o
    // mesmo access token, evitando rotação duplicada e chamadas redundantes.
    refreshInFlight = executeRefresh().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

async function executeApiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const {
    authenticated = true,
    retryAfterRefresh = true,
    headers,
    ...requestOptions
  } = options

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: buildHeaders(headers, authenticated),
  })

  if (response.ok) {
    return response
  }

  const payload = await readErrorPayload(response)
  const detail = normalizeErrorDetail(payload)
  const isAuthenticationFailure =
    response.status === 401 ||
    (response.status === 403 && detail === AUTH_EXPIRED_DETAIL)

  if (authenticated && retryAfterRefresh && isAuthenticationFailure) {
    const refreshed = await refreshSession()

    if (refreshed) {
      return executeApiRequest(path, {
        ...options,
        retryAfterRefresh: false,
      })
    }
  }

  if (isAuthenticationFailure) {
    clearAuthTokens()
  }

  throw new ApiError(response.status, detail)
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await executeApiRequest(path, options)

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiDownload(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  // Downloads usam a mesma renovação de sessão das chamadas JSON. A diferença
  // é somente o parser final, preservando autenticação e tratamento de erros.
  const response = await executeApiRequest(path, options)
  return response.blob()
}