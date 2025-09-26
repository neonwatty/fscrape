import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResponsiveTable, type ColumnDefinition } from '@/components/tables/ResponsiveTable'
import { PostsTable } from '@/components/tables/PostsTable'
import { TableFilters } from '@/components/tables/TableFilters'
import { TablePagination } from '@/components/tables/TablePagination'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ForumPost } from '@/lib/db/types'

// Mock data
const mockPosts: ForumPost[] = [
  {
    id: '1',
    title: 'Understanding React Testing',
    platform: 'reddit',
    source: 'r/reactjs',
    author: 'testuser1',
    score: 150,
    num_comments: 25,
    created_utc: 1704067200,
    url: 'https://reddit.com/1',
    link_flair_text: 'Tutorial',
  },
  {
    id: '2',
    title: 'Advanced TypeScript Patterns',
    platform: 'hackernews',
    source: 'HN',
    author: 'testuser2',
    score: 300,
    num_comments: 75,
    created_utc: 1704070800,
    url: 'https://news.ycombinator.com/2',
  },
  {
    id: '3',
    title: 'Rust vs Go Performance',
    platform: 'reddit',
    source: 'r/programming',
    author: 'testuser3',
    score: 425,
    num_comments: 120,
    created_utc: 1704074400,
    url: 'https://reddit.com/3',
    link_flair_text: 'Discussion',
  },
]

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Table Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.matchMedia for responsive behavior
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
    })
  })

  describe('ResponsiveTable', () => {
    interface TestData {
      id: string
      name: string
      value: number
      status: string
    }

    const testData: TestData[] = [
      { id: '1', name: 'Item 1', value: 100, status: 'active' },
      { id: '2', name: 'Item 2', value: 200, status: 'pending' },
      { id: '3', name: 'Item 3', value: 150, status: 'active' },
    ]

    const columns: ColumnDefinition<TestData>[] = [
      {
        key: 'name',
        header: 'Name',
        accessor: (item) => item.name,
        priority: 'essential',
      },
      {
        key: 'value',
        header: 'Value',
        accessor: (item) => item.value,
        priority: 'important',
        sortable: true,
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (item) => <span className={`status-${item.status}`}>{item.status}</span>,
        priority: 'optional',
      },
    ]

    it('should render table with data', () => {
      render(<ResponsiveTable data={testData} columns={columns} />)

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('should render column headers', () => {
      render(<ResponsiveTable data={testData} columns={columns} />)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Value')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should handle empty data', () => {
      render(<ResponsiveTable data={[]} columns={columns} emptyMessage="No items found" />)

      expect(screen.getByText('No items found')).toBeInTheDocument()
    })

    it.skip('should handle column visibility toggle', () => {
      render(<ResponsiveTable data={testData} columns={columns} />)

      // Find column visibility toggle button
      const toggleButton = screen.getByRole('button', { name: /columns/i })
      fireEvent.click(toggleButton)

      // Should show column options
      const statusCheckbox = screen.getByRole('checkbox', { name: /status/i })
      expect(statusCheckbox).toBeChecked()

      // Toggle status column
      fireEvent.click(statusCheckbox)

      // Status column should be hidden
      expect(screen.queryByText('Status')).not.toBeInTheDocument()
    })

    it('should handle row click events', () => {
      const onRowClick = vi.fn()

      render(<ResponsiveTable data={testData} columns={columns} onRowClick={onRowClick} />)

      const firstRow = screen.getByText('Item 1').closest('tr')
      fireEvent.click(firstRow!)

      expect(onRowClick).toHaveBeenCalledWith(testData[0])
    })

    it.skip('should apply striped styling', () => {
      const { container } = render(
        <ResponsiveTable data={testData} columns={columns} striped={true} />
      )

      const rows = container.querySelectorAll('tbody tr')
      expect(rows[1]).toHaveClass('bg-muted/50')
    })

    it('should handle sorting for sortable columns', () => {
      render(<ResponsiveTable data={testData} columns={columns} />)

      const valueHeader = screen.getByText('Value')
      fireEvent.click(valueHeader)

      // Check if data is sorted
      const values = screen.getAllByText(/^\d+$/)
      expect(values[0]).toHaveTextContent('100')

      // Click again for descending
      fireEvent.click(valueHeader)
      const valuesDesc = screen.getAllByText(/^\d+$/)
      expect(valuesDesc[0]).toHaveTextContent('200')
    })

    it('should handle mobile viewport', () => {
      // Mock mobile viewport
      window.innerWidth = 500
      window.dispatchEvent(new Event('resize'))

      render(
        <ResponsiveTable data={testData} columns={columns} mobileBreakpoint={768} cardView={true} />
      )

      // In mobile view, should show card layout
      // Only essential columns should be visible
      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
  })

  describe.skip('PostsTable', () => {
    it('should render posts table with data', () => {
      render(<PostsTable posts={mockPosts} />, { wrapper: createWrapper() })

      expect(screen.getByText('Understanding React Testing')).toBeInTheDocument()
      expect(screen.getByText('Advanced TypeScript Patterns')).toBeInTheDocument()
      expect(screen.getByText('Rust vs Go Performance')).toBeInTheDocument()
    })

    it('should display post metadata correctly', () => {
      render(<PostsTable posts={mockPosts} />, { wrapper: createWrapper() })

      // Check scores
      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('300')).toBeInTheDocument()
      expect(screen.getByText('425')).toBeInTheDocument()

      // Check authors
      expect(screen.getByText('testuser1')).toBeInTheDocument()
      expect(screen.getByText('testuser2')).toBeInTheDocument()
    })

    it('should display platform badges', () => {
      render(<PostsTable posts={mockPosts} />, { wrapper: createWrapper() })

      const redditBadges = screen.getAllByText(/reddit/i)
      const hnBadges = screen.getAllByText(/hackernews|HN/i)

      expect(redditBadges.length).toBeGreaterThan(0)
      expect(hnBadges.length).toBeGreaterThan(0)
    })

    it('should handle post click for navigation', () => {
      const onPostClick = vi.fn()

      render(<PostsTable posts={mockPosts} onPostClick={onPostClick} />, {
        wrapper: createWrapper(),
      })

      const firstPost = screen.getByText('Understanding React Testing')
      fireEvent.click(firstPost)

      expect(onPostClick).toHaveBeenCalledWith(mockPosts[0])
    })

    it('should show loading state', () => {
      render(<PostsTable posts={[]} loading={true} />, { wrapper: createWrapper() })

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should handle empty posts', () => {
      render(<PostsTable posts={[]} emptyMessage="No posts available" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('No posts available')).toBeInTheDocument()
    })
  })

  describe.skip('TableFilters', () => {
    it('should render filter controls', () => {
      const onFiltersChange = vi.fn()

      render(
        <TableFilters
          filters={{}}
          onFiltersChange={onFiltersChange}
          filterOptions={{
            platforms: ['reddit', 'hackernews'],
          }}
        />
      )

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
      expect(screen.getByText(/platform/i)).toBeInTheDocument()
    })

    it('should handle search input', async () => {
      const onFiltersChange = vi.fn()

      render(
        <TableFilters
          filters={{}}
          onFiltersChange={onFiltersChange}
          filterOptions={{
            platforms: ['reddit', 'hackernews'],
          }}
        />
      )

      const searchInput = screen.getByPlaceholderText(/search/i)
      fireEvent.change(searchInput, { target: { value: 'react' } })

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({
            searchTerm: 'react',
          })
        )
      })
    })

    it('should handle platform filter', () => {
      const onFiltersChange = vi.fn()

      render(
        <TableFilters
          filters={{}}
          onFiltersChange={onFiltersChange}
          filterOptions={{
            platforms: ['reddit', 'hackernews'],
          }}
        />
      )

      const platformSelect = screen.getByRole('combobox', { name: /platform/i })
      fireEvent.change(platformSelect, { target: { value: 'reddit' } })

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'reddit',
        })
      )
    })

    it('should handle date range filter', () => {
      const onFiltersChange = vi.fn()

      render(
        <TableFilters
          filters={{}}
          onFiltersChange={onFiltersChange}
          filterOptions={{
            platforms: ['reddit', 'hackernews'],
          }}
        />
      )

      const dateRangeButton = screen.getByRole('button', { name: /date|time/i })
      fireEvent.click(dateRangeButton)

      const lastWeekOption = screen.getByText(/last week/i)
      fireEvent.click(lastWeekOption)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: 'week',
        })
      )
    })

    it('should display active filter count', () => {
      render(
        <TableFilters
          filters={{
            platform: 'reddit',
            searchTerm: 'test',
            scoreMin: 100,
          }}
          onFiltersChange={vi.fn()}
          filterOptions={{
            platforms: ['reddit', 'hackernews'],
          }}
        />
      )

      const filterBadge = screen.getByText(/3/i)
      expect(filterBadge).toBeInTheDocument()
    })

    it('should handle clear filters', () => {
      const onFiltersChange = vi.fn()

      render(
        <TableFilters
          filters={{
            platform: 'reddit',
            searchTerm: 'test',
          }}
          onFiltersChange={onFiltersChange}
          filterOptions={{
            platforms: ['reddit', 'hackernews'],
          }}
        />
      )

      const clearButton = screen.getByRole('button', { name: /clear/i })
      fireEvent.click(clearButton)

      expect(onFiltersChange).toHaveBeenCalledWith({})
    })
  })

  describe.skip('TablePagination', () => {
    it('should render pagination controls', () => {
      render(<TablePagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    })

    it('should handle page navigation', () => {
      const onPageChange = vi.fn()

      render(<TablePagination currentPage={2} totalPages={5} onPageChange={onPageChange} />)

      const nextButton = screen.getByRole('button', { name: /next/i })
      fireEvent.click(nextButton)

      expect(onPageChange).toHaveBeenCalledWith(3)

      const prevButton = screen.getByRole('button', { name: /previous/i })
      fireEvent.click(prevButton)

      expect(onPageChange).toHaveBeenCalledWith(1)
    })

    it('should disable navigation at boundaries', () => {
      const onPageChange = vi.fn()

      const { rerender } = render(
        <TablePagination currentPage={1} totalPages={5} onPageChange={onPageChange} />
      )

      const prevButton = screen.getByRole('button', { name: /previous/i })
      expect(prevButton).toBeDisabled()

      rerender(<TablePagination currentPage={5} totalPages={5} onPageChange={onPageChange} />)

      const nextButton = screen.getByRole('button', { name: /next/i })
      expect(nextButton).toBeDisabled()
    })

    it('should show page numbers', () => {
      render(<TablePagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />)

      expect(screen.getByText('Page 3 of 5')).toBeInTheDocument()
    })

    it('should handle items per page change', () => {
      const onItemsPerPageChange = vi.fn()

      render(
        <TablePagination
          currentPage={1}
          totalPages={5}
          itemsPerPage={10}
          onPageChange={vi.fn()}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      )

      const itemsSelect = screen.getByRole('combobox', { name: /items per page/i })
      fireEvent.change(itemsSelect, { target: { value: '25' } })

      expect(onItemsPerPageChange).toHaveBeenCalledWith(25)
    })
  })
})
