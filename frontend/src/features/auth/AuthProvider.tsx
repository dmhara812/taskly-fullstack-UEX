import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  clearAuthTokens,
  readAuthTokens,
  subscribeToAuthChanges,
  writeAuthTokens,
} from '../../lib/auth-storage'
import * as authApi from './api'
import { AuthContext, type AuthContextValue } from './auth-context'
import type { LoginCredentials, RegisterPayload } from './types'

const CURRENT_USER_QUERY_KEY = ['auth', 'current-user'] as const

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [hasTokens, setHasTokens] = useState(() => Boolean(readAuthTokens()))

  useEffect(
    () =>
      subscribeToAuthChanges(() => {
        const nextHasTokens = Boolean(readAuthTokens())
        setHasTokens(nextHasTokens)

        if (!nextHasTokens) {
          queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
        }
      }),
    [queryClient],
  )

  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: authApi.getCurrentUser,
    enabled: hasTokens,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const persistSession = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      const tokens = await authApi.login(credentials)

      if (!tokens.refresh_token) {
        throw new Error('A API não retornou o refresh token esperado.')
      }

      writeAuthTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      })
      setHasTokens(true)
      await queryClient.fetchQuery({
        queryKey: CURRENT_USER_QUERY_KEY,
        queryFn: authApi.getCurrentUser,
      })
    },
    [queryClient],
  )

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      await persistSession(credentials)
    },
    [persistSession],
  )

  const register = useCallback(
    async (payload: RegisterPayload): Promise<void> => {
      await authApi.register(payload)
      await persistSession({ email: payload.email, password: payload.password })
    },
    [persistSession],
  )

  const logout = useCallback((): void => {
    clearAuthTokens()
    setHasTokens(false)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isAuthenticated: hasTokens && Boolean(currentUserQuery.data),
      isLoading: hasTokens && currentUserQuery.isPending,
      login,
      register,
      logout,
    }),
    [
      currentUserQuery.data,
      currentUserQuery.isPending,
      hasTokens,
      login,
      logout,
      register,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}