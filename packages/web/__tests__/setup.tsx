import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { vi, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Create a custom render function that includes providers
function AllTheProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything from RTL
export * from '@testing-library/react'

// Mock database utilities
export const mockDatabase = {
  query: vi.fn(),
  exec: vi.fn(),
  run: vi.fn(),
  prepare: vi.fn(),
  close: vi.fn(),
}

// Mock post data factory
export const createMockPost = (overrides = {}) => ({
  id: '1',
  title: 'Test Post Title',
  content: 'Test post content',
  author: 'TestAuthor',
  source: 'reddit',
  score: 100,
  comments: 50,
  created_utc: 1640995200,
  url: 'https://example.com/post',
  sentiment: 0.5,
  ...overrides,
})

// Mock time series data factory
export const createMockTimeSeriesData = (days = 7) => {
  const data = []
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  for (let i = 0; i < days; i++) {
    const date = new Date(now - (days - i - 1) * dayMs)
    data.push({
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 100) + 50,
      avgScore: Math.floor(Math.random() * 1000) + 100,
      avgComments: Math.floor(Math.random() * 100) + 10,
    })
  }

  return data
}

// Mock author stats factory
export const createMockAuthorStats = (overrides = {}) => ({
  author: 'TestAuthor',
  post_count: 10,
  total_score: 1000,
  total_comments: 500,
  avg_score: 100,
  avg_comments: 50,
  ...overrides,
})

// Mock platform stats factory
export const createMockPlatformStats = (overrides = {}) => ({
  platform: 'reddit',
  source: 'r/programming',
  totalPosts: 100,
  avgScore: 250,
  avgComments: 75,
  ...overrides,
})

// Wait utilities
export const waitForLoadingToFinish = async () => {
  const { waitFor, screen } = await import('@testing-library/react')
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })
}

// Mock fetch responses
export const mockFetch = (data: any, status = 200) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response)
}

// Database test utilities
export const setupTestDatabase = () => {
  const mockDb = {
    run: vi.fn().mockResolvedValue({ changes: 1 }),
    exec: vi.fn().mockResolvedValue([]),
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      step: vi.fn().mockReturnValue(true),
      getAsObject: vi.fn().mockReturnValue({}),
      free: vi.fn(),
    }),
    close: vi.fn(),
  }

  return mockDb
}

// Reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks()
  vi.resetModules()
}
