import { ForumPost, PostFilters } from '@/lib/db/types';

// Re-export PostFilters for convenience
export type { PostFilters };

// Filter preset types
export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: PostFilters;
}

// Default filter presets
export const defaultFilterPresets: FilterPreset[] = [
  {
    id: 'trending',
    name: 'Trending Posts',
    description: 'High engagement posts from the last 7 days',
    filters: {
      timeRange: 'week',
      scoreMin: 100,
      commentsMin: 10,
      sortBy: 'score',
      sortOrder: 'desc',
    },
  },
  {
    id: 'recent',
    name: 'Recent Activity',
    description: 'Latest posts from the last 24 hours',
    filters: {
      timeRange: 'day',
      sortBy: 'created_utc',
      sortOrder: 'desc',
    },
  },
  {
    id: 'top-discussions',
    name: 'Top Discussions',
    description: 'Posts with the most comments',
    filters: {
      commentsMin: 50,
      sortBy: 'num_comments',
      sortOrder: 'desc',
    },
  },
  {
    id: 'reddit-popular',
    name: 'Reddit Popular',
    description: 'Popular posts from Reddit',
    filters: {
      platform: 'reddit',
      scoreMin: 500,
      sortBy: 'score',
      sortOrder: 'desc',
    },
  },
  {
    id: 'hn-frontpage',
    name: 'HN Front Page',
    description: 'Hacker News front page worthy posts',
    filters: {
      platform: 'hackernews',
      scoreMin: 100,
      sortBy: 'score',
      sortOrder: 'desc',
    },
  },
];

// Apply filters to posts array
export function applyFilters(posts: ForumPost[], filters: PostFilters): ForumPost[] {
  let filteredPosts = [...posts];

  // Platform filter
  if (filters.platform && filters.platform !== 'all') {
    filteredPosts = filteredPosts.filter(
      (post) => post.platform.toLowerCase() === filters.platform?.toLowerCase()
    );
  }

  // Source filter
  if (filters.source) {
    filteredPosts = filteredPosts.filter((post) =>
      post.source.toLowerCase().includes(filters.source!.toLowerCase())
    );
  }

  // Author filter
  if (filters.author) {
    filteredPosts = filteredPosts.filter((post) =>
      post.author?.toLowerCase().includes(filters.author!.toLowerCase())
    );
  }

  // Search term filter (searches title and content)
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    filteredPosts = filteredPosts.filter(
      (post) =>
        post.title.toLowerCase().includes(searchLower) ||
        (post.content && post.content.toLowerCase().includes(searchLower))
    );
  }

  // Date range filters
  if (filters.dateFrom) {
    const fromTime = filters.dateFrom.getTime() / 1000; // Convert to Unix timestamp
    filteredPosts = filteredPosts.filter((post) => post.created_utc >= fromTime);
  }

  if (filters.dateTo) {
    const toTime = filters.dateTo.getTime() / 1000; // Convert to Unix timestamp
    filteredPosts = filteredPosts.filter((post) => post.created_utc <= toTime);
  }

  // Time range filter (convenience filter)
  if (filters.timeRange && filters.timeRange !== 'all') {
    const now = Date.now() / 1000; // Current Unix timestamp
    let cutoffTime = now;

    switch (filters.timeRange) {
      case 'day':
        cutoffTime = now - 24 * 60 * 60;
        break;
      case 'week':
        cutoffTime = now - 7 * 24 * 60 * 60;
        break;
      case 'month':
        cutoffTime = now - 30 * 24 * 60 * 60;
        break;
      case 'year':
        cutoffTime = now - 365 * 24 * 60 * 60;
        break;
    }

    filteredPosts = filteredPosts.filter((post) => post.created_utc >= cutoffTime);
  }

  // Score range filters
  if (filters.scoreMin !== undefined) {
    filteredPosts = filteredPosts.filter((post) => post.score >= filters.scoreMin!);
  }

  if (filters.scoreMax !== undefined) {
    filteredPosts = filteredPosts.filter((post) => post.score <= filters.scoreMax!);
  }

  // Comments range filters
  if (filters.commentsMin !== undefined) {
    filteredPosts = filteredPosts.filter((post) => post.num_comments >= filters.commentsMin!);
  }

  if (filters.commentsMax !== undefined) {
    filteredPosts = filteredPosts.filter((post) => post.num_comments <= filters.commentsMax!);
  }

  // Category filter (for Reddit link flair or HN category)
  if (filters.category) {
    filteredPosts = filteredPosts.filter((post) => {
      if (post.link_flair_text) {
        return post.link_flair_text.toLowerCase().includes(filters.category!.toLowerCase());
      }
      return false;
    });
  }

  // Sorting
  if (filters.sortBy) {
    filteredPosts.sort((a, b) => {
      let aValue: unknown = a[filters.sortBy as keyof ForumPost];
      let bValue: unknown = b[filters.sortBy as keyof ForumPost];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = 0;
      if (bValue === null || bValue === undefined) bValue = 0;

      // Convert to comparable values
      const aNum = typeof aValue === 'number' ? aValue : typeof aValue === 'string' ? aValue : 0;
      const bNum = typeof bValue === 'number' ? bValue : typeof bValue === 'string' ? bValue : 0;

      // Compare values
      if (aNum < bNum) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aNum > bNum) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Apply limit and offset for pagination
  if (filters.offset !== undefined || filters.limit !== undefined) {
    const start = filters.offset || 0;
    const end = filters.limit ? start + filters.limit : undefined;
    filteredPosts = filteredPosts.slice(start, end);
  }

  return filteredPosts;
}

// Get unique values for filter options
export function getFilterOptions(posts: ForumPost[]) {
  const platforms = new Set<string>();
  const sources = new Set<string>();
  const authors = new Set<string>();
  const categories = new Set<string>();

  posts.forEach((post) => {
    if (post.platform) platforms.add(post.platform);
    if (post.source) sources.add(post.source);
    if (post.author) authors.add(post.author);
    if (post.link_flair_text) categories.add(post.link_flair_text);
  });

  return {
    platforms: Array.from(platforms).sort(),
    sources: Array.from(sources).sort(),
    authors: Array.from(authors).sort(),
    categories: Array.from(categories).sort(),
  };
}

// Validate filter values
export function validateFilters(filters: PostFilters): PostFilters {
  const validated = { ...filters };

  // Ensure numeric values are valid
  if (validated.scoreMin !== undefined && validated.scoreMin < 0) {
    validated.scoreMin = 0;
  }

  if (validated.scoreMax !== undefined && validated.scoreMax < 0) {
    validated.scoreMax = 0;
  }

  if (validated.commentsMin !== undefined && validated.commentsMin < 0) {
    validated.commentsMin = 0;
  }

  if (validated.commentsMax !== undefined && validated.commentsMax < 0) {
    validated.commentsMax = 0;
  }

  // Ensure min/max relationships are valid
  if (validated.scoreMin !== undefined && validated.scoreMax !== undefined) {
    if (validated.scoreMin > validated.scoreMax) {
      const temp = validated.scoreMin;
      validated.scoreMin = validated.scoreMax;
      validated.scoreMax = temp;
    }
  }

  if (validated.commentsMin !== undefined && validated.commentsMax !== undefined) {
    if (validated.commentsMin > validated.commentsMax) {
      const temp = validated.commentsMin;
      validated.commentsMin = validated.commentsMax;
      validated.commentsMax = temp;
    }
  }

  // Ensure date relationships are valid
  if (validated.dateFrom && validated.dateTo) {
    if (validated.dateFrom > validated.dateTo) {
      const temp = validated.dateFrom;
      validated.dateFrom = validated.dateTo;
      validated.dateTo = temp;
    }
  }

  // Set default sort order if sortBy is specified but sortOrder is not
  if (validated.sortBy && !validated.sortOrder) {
    validated.sortOrder = 'desc';
  }

  return validated;
}

// Serialize filters to URL params
export function filtersToURLParams(filters: PostFilters): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (value instanceof Date) {
        params.set(key, value.toISOString());
      } else {
        params.set(key, String(value));
      }
    }
  });

  return params;
}

// Parse filters from URL params
export function filtersFromURLParams(params: URLSearchParams): PostFilters {
  const filters: PostFilters = {};

  // String fields
  const stringFields = [
    'platform',
    'source',
    'author',
    'searchTerm',
    'category',
    'timeRange',
    'sortBy',
    'sortOrder',
  ];
  stringFields.forEach((field) => {
    const value = params.get(field);
    if (value) {
      (filters as Record<string, string>)[field] = value;
    }
  });

  // Number fields
  const numberFields = ['scoreMin', 'scoreMax', 'commentsMin', 'commentsMax', 'limit', 'offset'];
  numberFields.forEach((field) => {
    const value = params.get(field);
    if (value && !isNaN(Number(value))) {
      (filters as Record<string, number>)[field] = Number(value);
    }
  });

  // Date fields
  const dateFields = ['dateFrom', 'dateTo'];
  dateFields.forEach((field) => {
    const value = params.get(field);
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        (filters as Record<string, Date>)[field] = date;
      }
    }
  });

  return validateFilters(filters);
}

// Get active filter count
export function getActiveFilterCount(filters: PostFilters): number {
  const excludeKeys = ['sortBy', 'sortOrder', 'limit', 'offset'];

  return Object.entries(filters).filter(([key, value]) => {
    return (
      !excludeKeys.includes(key) &&
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 'all'
    );
  }).length;
}

// Clear all filters except sorting and pagination
export function clearFilters(filters: PostFilters): PostFilters {
  return {
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    limit: filters.limit,
    offset: filters.offset,
  };
}
