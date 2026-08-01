import { describe, expect, it } from 'vitest'
import {
  clearAuthTokens,
  readAuthTokens,
  writeAuthTokens,
} from './auth-storage'

describe('auth storage', () => {
  it('persists and reads both tokens', () => {
    writeAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    expect(readAuthTokens()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('clears an invalid persisted payload', () => {
    window.localStorage.setItem('taskly.auth.tokens', '{invalid-json')

    expect(readAuthTokens()).toBeNull()
    expect(window.localStorage.getItem('taskly.auth.tokens')).toBeNull()
  })

  it('removes the current session', () => {
    writeAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    clearAuthTokens()

    expect(readAuthTokens()).toBeNull()
  })
})