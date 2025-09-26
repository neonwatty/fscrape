import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getPosts,
  getRecentPosts,
  getPostById,
  getPlatformStats,
  getPostsTimeSeries,
  getPostsByHour,
  getTopAuthors,
} from '@/lib/db/queries'
import type { ForumPost, PostFilters, PlatformStats } from '@/lib/db/types'

// Mock the sql-loader module
vi.mock('@/lib/db/sql-loader', () => ({
  executeQuery: vi.fn(),
  executeQueryFirst: vi.fn(),
}))

import { executeQuery, executeQueryFirst } from '@/lib/db/sql-loader'

describe('Database Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPosts', () => {
    const mockPosts: ForumPost[] = [
      {
        id: '1',
        platform: 'reddit',
        source: 'r/programming',
        title: 'Test Post',
        author: 'user1',
        score: 100,
        num_comments: 10,
        created_utc: 1704067200,
        url: 'https://reddit.com/1',
      },
    ] as ForumPost[]

    it('should fetch all posts without filters', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const result = getPosts()

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM posts WHERE 1=1'),
        []
      )
      expect(result).toEqual(mockPosts)
    })

    it('should apply platform filter', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { platform: 'reddit' }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('AND platform = ?'), [
        'reddit',
      ])
    })

    it('should apply source filter', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { source: 'r/programming' }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('AND subreddit = ?'), [
        'r/programming',
      ])
    })

    it('should apply author filter with LIKE pattern', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { author: 'user' }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('AND author LIKE ?'), [
        '%user%',
      ])
    })

    it('should apply search term to title and body', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { searchTerm: 'test' }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND (title LIKE ? OR body LIKE ?)'),
        ['%test%', '%test%']
      )
    })

    it('should apply date range filters', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const dateFrom = new Date('2024-01-01')
      const dateTo = new Date('2024-01-31')
      const filters: PostFilters = { dateFrom, dateTo }

      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND created_utc >= ? AND created_utc <= ?'),
        [Math.floor(dateFrom.getTime() / 1000), Math.floor(dateTo.getTime() / 1000)]
      )
    })

    it('should apply score range filters', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { scoreMin: 50, scoreMax: 200 }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND score >= ? AND score <= ?'),
        [50, 200]
      )
    })

    it('should apply comments range filters', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { commentsMin: 5, commentsMax: 50 }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND num_comments >= ? AND num_comments <= ?'),
        [5, 50]
      )
    })

    it('should apply time range filter - day', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { timeRange: 'day' }
      getPosts(filters)

      const call = vi.mocked(executeQuery).mock.calls[0]
      const sql = call[0] as string
      const params = call[1] as unknown[]

      expect(sql).toContain('AND created_utc >= ?')
      expect(params[0]).toBeGreaterThan(Math.floor(Date.now() / 1000) - 86400 - 1)
    })

    it('should apply sorting', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { sortBy: 'score', sortOrder: 'desc' }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY score DESC'), [])
    })

    it('should apply pagination', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = { limit: 10, offset: 20 }
      getPosts(filters)

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        [10, 20]
      )
    })

    it('should combine multiple filters', () => {
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const filters: PostFilters = {
        platform: 'reddit',
        scoreMin: 100,
        sortBy: 'created_utc',
        sortOrder: 'desc',
        limit: 50,
      }

      getPosts(filters)

      const call = vi.mocked(executeQuery).mock.calls[0]
      const sql = call[0] as string
      const params = call[1] as unknown[]

      expect(sql).toContain('AND platform = ?')
      expect(sql).toContain('AND score >= ?')
      expect(sql).toContain('ORDER BY created_utc DESC')
      expect(sql).toContain('LIMIT ?')
      expect(params).toEqual(['reddit', 100, 50])
    })
  })

  describe('getPostById', () => {
    it('should fetch a single post by id', () => {
      const mockPost = { id: '123', title: 'Test' } as ForumPost
      vi.mocked(executeQueryFirst).mockReturnValue(mockPost)

      const result = getPostById('123')

      expect(executeQueryFirst).toHaveBeenCalledWith('SELECT * FROM posts WHERE id = ?', ['123'])
      expect(result).toEqual(mockPost)
    })

    it('should return null for non-existent post', () => {
      vi.mocked(executeQueryFirst).mockReturnValue(null)

      const result = getPostById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getRecentPosts', () => {
    it('should fetch recent posts with default limit', () => {
      const mockPosts = [{ id: '1', title: 'Recent' }] as ForumPost[]
      vi.mocked(executeQuery).mockReturnValue(mockPosts)

      const result = getRecentPosts()

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_utc DESC'),
        [10]
      )
      expect(result).toEqual(mockPosts)
    })

    it('should fetch recent posts with custom limit', () => {
      vi.mocked(executeQuery).mockReturnValue([])

      getRecentPosts(20)

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), [20])
    })
  })

  describe('getPlatformStats', () => {
    it('should fetch platform statistics', () => {
      const mockStats: PlatformStats[] = [
        {
          platform: 'reddit',
          totalPosts: 100,
          avgScore: 250.5,
          avgComments: 25.3,
          totalScore: 25050,
          totalComments: 2530,
        },
      ]
      vi.mocked(executeQuery).mockReturnValue(mockStats)

      const result = getPlatformStats()

      expect(executeQuery).toHaveBeenCalled()
      expect(result).toEqual(mockStats)
    })
  })

  describe('getPostsTimeSeries', () => {
    it('should fetch time series data with default 30 days', () => {
      const mockData = [{ date: '2024-01-01', count: 10, avgScore: 100, avgComments: 20 }]
      vi.mocked(executeQuery).mockReturnValue(mockData)

      const result = getPostsTimeSeries()

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("DATE(created_utc, 'unixepoch')"),
        expect.any(Array)
      )
      expect(result).toEqual(mockData)
    })

    it('should apply custom days parameter', () => {
      vi.mocked(executeQuery).mockReturnValue([])

      getPostsTimeSeries(7)

      const call = vi.mocked(executeQuery).mock.calls[0]
      const params = call[1] as unknown[]

      // Check that the timestamp is approximately 7 days ago
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400
      expect(params[0]).toBeGreaterThan(sevenDaysAgo - 10)
      expect(params[0]).toBeLessThan(sevenDaysAgo + 10)
    })
  })

  describe('getTopAuthors', () => {
    it('should fetch top authors with statistics', () => {
      const mockAuthors = [
        {
          author: 'user1',
          postCount: 10,
          totalScore: 1000,
          avgScore: 100,
          totalComments: 500,
        },
      ]
      vi.mocked(executeQuery).mockReturnValue(mockAuthors)

      const result = getTopAuthors()

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('GROUP BY author'), [10])
      expect(result).toEqual(mockAuthors)
    })

    it('should apply custom limit', () => {
      vi.mocked(executeQuery).mockReturnValue([])

      getTopAuthors(20)

      expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), [20])
    })
  })

  describe('getPostsByHour', () => {
    it('should fetch posts grouped by hour', () => {
      const mockData = [
        { hour: 0, count: 5, avgScore: 100 },
        { hour: 12, count: 10, avgScore: 200 },
      ]
      vi.mocked(executeQuery).mockReturnValue(mockData)

      const result = getPostsByHour()

      expect(executeQuery).toHaveBeenCalled()
      expect(result).toEqual(mockData)
    })

    it('should apply custom days parameter', () => {
      vi.mocked(executeQuery).mockReturnValue([])

      getPostsByHour(14)

      const call = vi.mocked(executeQuery).mock.calls[0]
      const params = call[1] as unknown[]

      // Check that the timestamp is approximately 14 days ago
      const fourteenDaysAgo = Math.floor(Date.now() / 1000) - 14 * 86400
      expect(params[0]).toBeGreaterThan(fourteenDaysAgo - 10)
      expect(params[0]).toBeLessThan(fourteenDaysAgo + 10)
    })
  })
})
