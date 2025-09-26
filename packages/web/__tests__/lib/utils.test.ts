import { describe, it, expect, beforeEach } from 'vitest'
import { cn } from '@/lib/utils'
import {
  applyFilters,
  getFilterOptions,
  validateFilters,
  filtersToURLParams,
  filtersFromURLParams,
  getActiveFilterCount,
  clearFilters,
  defaultFilterPresets,
} from '@/lib/utils/filters'
import type { ForumPost, PostFilters } from '@/lib/db/types'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('should override tailwind classes properly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('should handle arrays of classes', () => {
    expect(cn(['px-2', 'py-1'], 'mt-4')).toBe('px-2 py-1 mt-4')
  })

  it('should filter out falsy values', () => {
    expect(cn('base', null, undefined, false, '', 'active')).toBe('base active')
  })
})

describe('Filter utilities', () => {
  let mockPosts: ForumPost[]

  beforeEach(() => {
    mockPosts = [
      {
        id: '1',
        platform: 'reddit',
        source: 'r/programming',
        title: 'Test Post 1',
        content: 'Content 1',
        author: 'user1',
        score: 100,
        num_comments: 10,
        created_utc: Date.now() / 1000 - 3600, // 1 hour ago
        url: 'https://reddit.com/1',
        link_flair_text: 'Discussion',
      },
      {
        id: '2',
        platform: 'hackernews',
        source: 'HN',
        title: 'Test Post 2',
        content: 'Content 2',
        author: 'user2',
        score: 500,
        num_comments: 50,
        created_utc: Date.now() / 1000 - 86400, // 1 day ago
        url: 'https://news.ycombinator.com/2',
      },
      {
        id: '3',
        platform: 'reddit',
        source: 'r/rust',
        title: 'Rust Post',
        content: 'Rust content',
        author: 'user3',
        score: 50,
        num_comments: 5,
        created_utc: Date.now() / 1000 - 604800, // 1 week ago
        url: 'https://reddit.com/3',
        link_flair_text: 'Help',
      },
    ] as ForumPost[]
  })

  describe('applyFilters', () => {
    it('should return all posts when no filters applied', () => {
      const result = applyFilters(mockPosts, {})
      expect(result).toHaveLength(3)
    })

    it('should filter by platform', () => {
      const result = applyFilters(mockPosts, { platform: 'reddit' })
      expect(result).toHaveLength(2)
      expect(result.every((p) => p.platform === 'reddit')).toBe(true)
    })

    it('should filter by source', () => {
      const result = applyFilters(mockPosts, { source: 'programming' })
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('r/programming')
    })

    it('should filter by author', () => {
      const result = applyFilters(mockPosts, { author: 'user2' })
      expect(result).toHaveLength(1)
      expect(result[0].author).toBe('user2')
    })

    it('should filter by search term in title', () => {
      const result = applyFilters(mockPosts, { searchTerm: 'Rust' })
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Rust Post')
    })

    it('should filter by search term in content', () => {
      const result = applyFilters(mockPosts, { searchTerm: 'content' })
      expect(result).toHaveLength(3)
    })

    it('should filter by minimum score', () => {
      const result = applyFilters(mockPosts, { scoreMin: 100 })
      expect(result).toHaveLength(2)
      expect(result.every((p) => p.score >= 100)).toBe(true)
    })

    it('should filter by maximum score', () => {
      const result = applyFilters(mockPosts, { scoreMax: 100 })
      expect(result).toHaveLength(2)
      expect(result.every((p) => p.score <= 100)).toBe(true)
    })

    it('should filter by minimum comments', () => {
      const result = applyFilters(mockPosts, { commentsMin: 10 })
      expect(result).toHaveLength(2)
      expect(result.every((p) => p.num_comments >= 10)).toBe(true)
    })

    it('should filter by time range - day', () => {
      const result = applyFilters(mockPosts, { timeRange: 'day' })
      // Should include posts from last 24 hours (post 1 and 2)
      expect(result).toHaveLength(2)
      expect(result.some((p) => p.id === '1')).toBe(true)
      expect(result.some((p) => p.id === '2')).toBe(true)
    })

    it('should filter by time range - week', () => {
      const result = applyFilters(mockPosts, { timeRange: 'week' })
      // All posts are within a week
      expect(result).toHaveLength(3)
    })

    it('should filter by category (link flair)', () => {
      const result = applyFilters(mockPosts, { category: 'Discussion' })
      expect(result).toHaveLength(1)
      expect(result[0].link_flair_text).toBe('Discussion')
    })

    it('should apply multiple filters', () => {
      const result = applyFilters(mockPosts, {
        platform: 'reddit',
        scoreMin: 60,
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('should sort by score descending', () => {
      const result = applyFilters(mockPosts, {
        sortBy: 'score',
        sortOrder: 'desc',
      })
      expect(result[0].score).toBe(500)
      expect(result[1].score).toBe(100)
      expect(result[2].score).toBe(50)
    })

    it('should sort by score ascending', () => {
      const result = applyFilters(mockPosts, {
        sortBy: 'score',
        sortOrder: 'asc',
      })
      expect(result[0].score).toBe(50)
      expect(result[1].score).toBe(100)
      expect(result[2].score).toBe(500)
    })

    it('should apply pagination with limit and offset', () => {
      const result = applyFilters(mockPosts, {
        limit: 2,
        offset: 1,
      })
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('2')
      expect(result[1].id).toBe('3')
    })
  })

  describe('getFilterOptions', () => {
    it('should extract unique filter options from posts', () => {
      const options = getFilterOptions(mockPosts)

      expect(options.platforms).toEqual(['hackernews', 'reddit'])
      expect(options.sources).toContain('r/programming')
      expect(options.sources).toContain('HN')
      expect(options.authors).toContain('user1')
      expect(options.authors).toContain('user2')
      expect(options.categories).toContain('Discussion')
      expect(options.categories).toContain('Help')
    })

    it('should return empty arrays for empty posts', () => {
      const options = getFilterOptions([])

      expect(options.platforms).toEqual([])
      expect(options.sources).toEqual([])
      expect(options.authors).toEqual([])
      expect(options.categories).toEqual([])
    })
  })

  describe('validateFilters', () => {
    it('should fix negative numeric values', () => {
      const filters: PostFilters = {
        scoreMin: -10,
        scoreMax: -5,
        commentsMin: -1,
        commentsMax: -2,
      }

      const validated = validateFilters(filters)

      expect(validated.scoreMin).toBe(0)
      expect(validated.scoreMax).toBe(0)
      expect(validated.commentsMin).toBe(0)
      expect(validated.commentsMax).toBe(0)
    })

    it('should swap min/max values if reversed', () => {
      const filters: PostFilters = {
        scoreMin: 100,
        scoreMax: 50,
        commentsMin: 20,
        commentsMax: 10,
      }

      const validated = validateFilters(filters)

      expect(validated.scoreMin).toBe(50)
      expect(validated.scoreMax).toBe(100)
      expect(validated.commentsMin).toBe(10)
      expect(validated.commentsMax).toBe(20)
    })

    it('should swap date values if reversed', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-10')

      const filters: PostFilters = {
        dateFrom: date2,
        dateTo: date1,
      }

      const validated = validateFilters(filters)

      expect(validated.dateFrom).toEqual(date1)
      expect(validated.dateTo).toEqual(date2)
    })

    it('should add default sort order when sortBy is specified', () => {
      const filters: PostFilters = {
        sortBy: 'score',
      }

      const validated = validateFilters(filters)

      expect(validated.sortOrder).toBe('desc')
    })
  })

  describe('filtersToURLParams', () => {
    it('should convert filters to URL params', () => {
      const filters: PostFilters = {
        platform: 'reddit',
        scoreMin: 100,
        sortBy: 'score',
        sortOrder: 'desc',
      }

      const params = filtersToURLParams(filters)

      expect(params.get('platform')).toBe('reddit')
      expect(params.get('scoreMin')).toBe('100')
      expect(params.get('sortBy')).toBe('score')
      expect(params.get('sortOrder')).toBe('desc')
    })

    it('should handle date conversion', () => {
      const date = new Date('2024-01-01T00:00:00Z')
      const filters: PostFilters = {
        dateFrom: date,
      }

      const params = filtersToURLParams(filters)

      expect(params.get('dateFrom')).toBe(date.toISOString())
    })

    it('should skip undefined and null values', () => {
      const filters: PostFilters = {
        platform: 'reddit',
        source: undefined,
        author: null as any,
        scoreMin: 0,
      }

      const params = filtersToURLParams(filters)

      expect(params.has('platform')).toBe(true)
      expect(params.has('source')).toBe(false)
      expect(params.has('author')).toBe(false)
      expect(params.has('scoreMin')).toBe(true)
    })
  })

  describe('filtersFromURLParams', () => {
    it('should parse string fields from URL params', () => {
      const params = new URLSearchParams({
        platform: 'reddit',
        source: 'r/programming',
        sortBy: 'score',
        sortOrder: 'desc',
      })

      const filters = filtersFromURLParams(params)

      expect(filters.platform).toBe('reddit')
      expect(filters.source).toBe('r/programming')
      expect(filters.sortBy).toBe('score')
      expect(filters.sortOrder).toBe('desc')
    })

    it('should parse number fields from URL params', () => {
      const params = new URLSearchParams({
        scoreMin: '100',
        scoreMax: '500',
        limit: '10',
        offset: '20',
      })

      const filters = filtersFromURLParams(params)

      expect(filters.scoreMin).toBe(100)
      expect(filters.scoreMax).toBe(500)
      expect(filters.limit).toBe(10)
      expect(filters.offset).toBe(20)
    })

    it('should parse date fields from URL params', () => {
      const date = new Date('2024-01-01T00:00:00Z')
      const params = new URLSearchParams({
        dateFrom: date.toISOString(),
      })

      const filters = filtersFromURLParams(params)

      expect(filters.dateFrom).toEqual(date)
    })

    it('should ignore invalid number values', () => {
      const params = new URLSearchParams({
        scoreMin: 'not-a-number',
      })

      const filters = filtersFromURLParams(params)

      expect(filters.scoreMin).toBeUndefined()
    })

    it('should validate parsed filters', () => {
      const params = new URLSearchParams({
        scoreMin: '100',
        scoreMax: '50', // Invalid: min > max
        sortBy: 'score',
      })

      const filters = filtersFromURLParams(params)

      expect(filters.scoreMin).toBe(50) // Should be swapped
      expect(filters.scoreMax).toBe(100)
      expect(filters.sortOrder).toBe('desc') // Default added
    })
  })

  describe('getActiveFilterCount', () => {
    it('should count active filters excluding sort and pagination', () => {
      const filters: PostFilters = {
        platform: 'reddit',
        scoreMin: 100,
        sortBy: 'score',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      }

      const count = getActiveFilterCount(filters)

      expect(count).toBe(2) // platform and scoreMin
    })

    it('should not count undefined, null, empty, or "all" values', () => {
      const filters: PostFilters = {
        platform: 'all',
        source: '',
        author: undefined,
        scoreMin: 0,
        timeRange: 'all',
      }

      const count = getActiveFilterCount(filters)

      expect(count).toBe(1) // Only scoreMin
    })
  })

  describe('clearFilters', () => {
    it('should keep only sorting and pagination', () => {
      const filters: PostFilters = {
        platform: 'reddit',
        scoreMin: 100,
        searchTerm: 'test',
        sortBy: 'score',
        sortOrder: 'desc',
        limit: 10,
        offset: 20,
      }

      const cleared = clearFilters(filters)

      expect(cleared).toEqual({
        sortBy: 'score',
        sortOrder: 'desc',
        limit: 10,
        offset: 20,
      })
    })
  })

  describe('defaultFilterPresets', () => {
    it('should have valid preset configurations', () => {
      expect(defaultFilterPresets).toHaveLength(5)

      const trending = defaultFilterPresets.find((p) => p.id === 'trending')
      expect(trending).toBeDefined()
      expect(trending?.filters.timeRange).toBe('week')
      expect(trending?.filters.scoreMin).toBe(100)

      const recent = defaultFilterPresets.find((p) => p.id === 'recent')
      expect(recent).toBeDefined()
      expect(recent?.filters.timeRange).toBe('day')
      expect(recent?.filters.sortBy).toBe('created_utc')
    })
  })
})
