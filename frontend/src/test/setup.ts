import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  window.localStorage.clear()

  // Impede que mocks de fetch de um teste interfiram no próximo.
  vi.restoreAllMocks()
})