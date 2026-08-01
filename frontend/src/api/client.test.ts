import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeAuthTokens } from '../lib/auth-storage'
import { apiDownload, apiRequest } from './client'


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


  it('downloads protected binary content with the current access token', async () => {
    writeAuthTokens({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
    })

    // O Blob é criado pelo mesmo ambiente jsdom usado pelo teste.
    // O Response é simulado somente com o contrato consumido pelo apiDownload,
    // evitando misturar o Blob nativo do Node com o FileReader do jsdom.
    const expectedBlob = new Blob(['arquivo'], {
      type: 'application/pdf',
    })

    const blobParser = vi.fn().mockResolvedValue(expectedBlob)

    const mockedResponse = {
      ok: true,
      status: 200,
      headers: new Headers({
        'Content-Type': 'application/pdf',
      }),
      blob: blobParser,
    } as unknown as Response

    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(mockedResponse)

    const blob = await apiDownload(
      '/attachments/attachment-1/content',
    )

    expect(blob).toBe(expectedBlob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBe(7)
    expect(blobParser).toHaveBeenCalledOnce()

    const headers = new Headers(
      fetchSpy.mock.calls[0][1]?.headers,
    )

    expect(headers.get('Authorization')).toBe(
      'Bearer valid-access-token',
    )
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