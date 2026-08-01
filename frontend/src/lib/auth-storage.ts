export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

const STORAGE_KEY = 'taskly.auth.tokens'
const AUTH_CHANGED_EVENT = 'taskly:auth-changed'

function emitAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function readAuthTokens(): AuthTokens | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const value = JSON.parse(rawValue) as Partial<AuthTokens>

    if (!value.accessToken || !value.refreshToken) {
      clearAuthTokens()
      return null
    }

    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
    }
  } catch {
    clearAuthTokens()
    return null
  }
}

export function writeAuthTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  emitAuthChanged()
}

export function clearAuthTokens(): void {
  window.localStorage.removeItem(STORAGE_KEY)
  emitAuthChanged()
}

export function subscribeToAuthChanges(callback: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}