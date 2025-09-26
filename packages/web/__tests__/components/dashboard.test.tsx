import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { PlatformSelector } from '@/components/dashboard/PlatformSelector'
import { RecentPosts } from '@/components/dashboard/RecentPosts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DatabaseContext, DatabaseContextType } from '@/components/providers/DatabaseProvider'

// Mock database context
const mockDatabaseContext: DatabaseContextType = {
  isLoading: false,
  isInitialized: true,
  error: null,
  summary: {
    totalPosts: 1500,
    totalAuthors: 250,
    platforms: ['reddit', 'hackernews'],
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    topSources: ['r/programming', 'r/rust', 'HN'],
  },
  loadDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  exportDatabase: vi.fn(),
  refreshData: vi.fn(),
  queryPosts: vi.fn(),
  queryRecentPosts: vi.fn(),
  queryTrendingPosts: vi.fn(),
  searchPostsQuery: vi.fn(),
  queryPlatformStats: vi.fn(),
  queryTimeSeries: vi.fn(),
  queryPostsByHour: vi.fn(),
  queryTopAuthors: vi.fn(),
  queryTopSources: vi.fn(),
  queryPostingHeatmap: vi.fn(),
  queryEngagementMetrics: vi.fn(),
  queryPlatformComparison: vi.fn(),
}

// Mock the queries module
vi.mock('@/lib/db/queries', () => ({
  getPosts: vi.fn((filters) => {
    // Return mock posts based on filters
    const mockPosts = [
      {
        id: '1',
        title: 'Test Post 1',
        platform: 'reddit',
        source: 'r/programming',
        author: 'user1',
        score: 100,
        num_comments: 25,
        created_utc: Date.now() / 1000 - 3600,
        url: 'https://reddit.com/1',
      },
      {
        id: '2',
        title: 'Test Post 2',
        platform: 'hackernews',
        source: 'HN',
        author: 'user2',
        score: 250,
        num_comments: 50,
        created_utc: Date.now() / 1000 - 7200,
        url: 'https://news.ycombinator.com/2',
      },
    ]

    if (filters?.limit) {
      return mockPosts.slice(0, filters.limit)
    }
    return mockPosts
  }),
  getPostsTimeSeries: vi.fn(() => [
    { date: '2024-01-01', count: 45, avgScore: 120, avgComments: 15 },
    { date: '2024-01-02', count: 52, avgScore: 150, avgComments: 20 },
    { date: '2024-01-03', count: 38, avgScore: 110, avgComments: 12 },
  ]),
}))

// Test wrapper with providers
const createWrapper = (contextValue = mockDatabaseContext) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    </QueryClientProvider>
  )
}

describe.skip('Dashboard Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('StatsCards', () => {
    it('should render main stats cards with correct values', () => {
      render(<StatsCards />, { wrapper: createWrapper() })

      // Check for main stats
      expect(screen.getByText('Total Posts')).toBeInTheDocument()
      expect(screen.getByText('Active Authors')).toBeInTheDocument()
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument()
      expect(screen.getByText('Avg Engagement')).toBeInTheDocument()
    })

    it('should display summary data from context', () => {
      render(<StatsCards />, { wrapper: createWrapper() })

      // Should display the total posts from summary
      expect(screen.getByText('1,500')).toBeInTheDocument()
      expect(screen.getByText('250')).toBeInTheDocument()
    })

    it('should show activity metrics section', () => {
      render(<StatsCards />, { wrapper: createWrapper() })

      expect(screen.getByText('Activity Metrics')).toBeInTheDocument()
      expect(screen.getByText('24 Hour Activity')).toBeInTheDocument()
      expect(screen.getByText('7 Day Activity')).toBeInTheDocument()
      expect(screen.getByText('30 Day Activity')).toBeInTheDocument()
    })

    it('should handle period selection for activity metrics', () => {
      render(<StatsCards />, { wrapper: createWrapper() })

      const buttons = screen.getAllByRole('button')
      const period24h = buttons.find((btn) => btn.textContent === '24h')
      const period7d = buttons.find((btn) => btn.textContent === '7d')

      expect(period7d).toHaveClass('bg-primary')

      // Click 24h period
      fireEvent.click(period24h!)
      expect(period24h).toHaveClass('bg-primary')
      expect(period7d).not.toHaveClass('bg-primary')
    })

    it('should display loading state', () => {
      const loadingContext = {
        ...mockDatabaseContext,
        isInitialized: false,
        isLoading: true,
      }

      render(<StatsCards />, { wrapper: createWrapper(loadingContext) })

      // Stats should show 0 when not initialized
      const zeroValues = screen.getAllByText('0')
      expect(zeroValues.length).toBeGreaterThan(0)
    })

    it('should show trend indicators when trends exist', async () => {
      render(<StatsCards />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Look for trend labels
        const trendLabels = screen.queryAllByText(/vs (last|prev)/)
        expect(trendLabels.length).toBeGreaterThan(0)
      })
    })
  })

  describe('PlatformSelector', () => {
    it('should render platform options', () => {
      const onSelect = vi.fn()
      render(<PlatformSelector selectedPlatform="all" onPlatformChange={onSelect} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('All Platforms')).toBeInTheDocument()
    })

    it('should handle platform selection', () => {
      const onSelect = vi.fn()
      const { rerender } = render(
        <PlatformSelector selectedPlatform="all" onPlatformChange={onSelect} />,
        { wrapper: createWrapper() }
      )

      // Click the dropdown trigger
      const trigger = screen.getByRole('button', { name: /all platforms/i })
      fireEvent.click(trigger)

      // Select Reddit option
      const redditOption = screen.getByText('Reddit')
      fireEvent.click(redditOption)

      expect(onSelect).toHaveBeenCalledWith('reddit')
    })

    it('should display platform counts from summary', () => {
      const onSelect = vi.fn()
      render(<PlatformSelector selectedPlatform="all" onPlatformChange={onSelect} />, {
        wrapper: createWrapper(),
      })

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /all platforms/i })
      fireEvent.click(trigger)

      // Check that platforms from summary are shown
      expect(screen.getByText('Reddit')).toBeInTheDocument()
      expect(screen.getByText('Hacker News')).toBeInTheDocument()
    })

    it('should highlight selected platform', () => {
      const onSelect = vi.fn()
      render(<PlatformSelector selectedPlatform="reddit" onPlatformChange={onSelect} />, {
        wrapper: createWrapper(),
      })

      const trigger = screen.getByRole('button')
      expect(trigger.textContent).toContain('Reddit')
    })
  })

  describe('RecentPosts', () => {
    it('should render recent posts section', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'Recent Post 1',
          author: 'author1',
          score: 150,
          num_comments: 30,
          platform: 'reddit',
          source: 'r/programming',
          created_utc: Date.now() / 1000 - 3600,
          url: 'https://reddit.com/1',
        },
      ]

      mockDatabaseContext.queryRecentPosts.mockReturnValue(mockPosts)

      render(<RecentPosts limit={5} />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Recent Posts')).toBeInTheDocument()
      })
    })

    it('should display post information correctly', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'Test Recent Post',
          author: 'testauthor',
          score: 200,
          num_comments: 45,
          platform: 'hackernews',
          source: 'HN',
          created_utc: Date.now() / 1000 - 3600,
          url: 'https://news.ycombinator.com/1',
        },
      ]

      mockDatabaseContext.queryRecentPosts.mockReturnValue(mockPosts)

      render(<RecentPosts limit={5} />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Test Recent Post')).toBeInTheDocument()
        expect(screen.getByText('testauthor')).toBeInTheDocument()
        expect(screen.getByText('200')).toBeInTheDocument()
      })
    })

    it('should handle empty posts state', async () => {
      mockDatabaseContext.queryRecentPosts.mockReturnValue([])

      render(<RecentPosts limit={5} />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/no recent posts/i)).toBeInTheDocument()
      })
    })

    it('should apply limit to posts query', () => {
      render(<RecentPosts limit={10} />, { wrapper: createWrapper() })

      expect(mockDatabaseContext.queryRecentPosts).toHaveBeenCalledWith(10)
    })

    it('should handle refresh action', async () => {
      render(<RecentPosts limit={5} showRefresh />, { wrapper: createWrapper() })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockDatabaseContext.refreshData).toHaveBeenCalled()
      })
    })

    it('should format timestamps correctly', async () => {
      const oneHourAgo = Date.now() / 1000 - 3600
      const mockPosts = [
        {
          id: '1',
          title: 'Time Test Post',
          author: 'author',
          score: 100,
          num_comments: 10,
          platform: 'reddit',
          source: 'r/test',
          created_utc: oneHourAgo,
          url: 'https://reddit.com/1',
        },
      ]

      mockDatabaseContext.queryRecentPosts.mockReturnValue(mockPosts)

      render(<RecentPosts limit={5} />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show relative time
        const timeElements = screen.queryAllByText(/hour|minute|second/i)
        expect(timeElements.length).toBeGreaterThan(0)
      })
    })
  })
})
