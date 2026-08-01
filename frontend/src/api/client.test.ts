import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeAuthTokens } from '../lib/auth-storage'
import { apiRequest } from './client'

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('refreshes an expired access token and retries once', async () => {
    writeAuthTokens({
      accessToken: 'expired-access-token',
      refreshToken: 'current-refresh-token',
    })

    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Invalid or expired token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            token_type: 'bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 'protected-data' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const response = await apiRequest<{ value: string }>('/protected')

    expect(response.value).toBe('protected-data')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('taskly.auth.tokens')).toContain(
      'new-refresh-token',
    )

    const retryHeaders = new Headers(fetchSpy.mock.calls[2][1]?.headers)
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access-token')
  })

  it('does not refresh a business-rule forbidden response', async () => {
    writeAuthTokens({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
    })
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Archived project is read-only' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiRequest('/tasks')).rejects.toMatchObject({
      status: 403,
      detail: 'Archived project is read-only',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})