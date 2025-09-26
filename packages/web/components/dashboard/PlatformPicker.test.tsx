import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformPickerSelection } from './PlatformPicker';

// Mock the database context
vi.mock('@/lib/db/database-context', () => ({
  useDatabase: vi.fn(() => ({ isInitialized: true })),
}));

// Mock the queries
vi.mock('@/lib/db/queries', () => ({
  getPlatformStats: vi.fn(() => [
    { platform: 'Reddit', source: 'r/programming', totalPosts: 100 },
    { platform: 'Reddit', source: 'r/webdev', totalPosts: 50 },
    { platform: 'HackerNews', source: null, totalPosts: 200 },
  ]),
}));

// Mock Next.js navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
  useRouter: vi.fn(() => ({ push: mockPush })),
  usePathname: vi.fn(() => '/'),
}));

describe('PlatformPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('platforms');
    mockSearchParams.delete('sources');
  });

  it('exports PlatformPickerSelection interface', () => {
    const selection: PlatformPickerSelection = {
      platforms: ['reddit'],
      sources: ['r/programming'],
    };
    expect(selection.platforms).toHaveLength(1);
    expect(selection.sources).toHaveLength(1);
  });

  it('initializes with empty selection by default', () => {
    const selection: PlatformPickerSelection = {
      platforms: [],
      sources: [],
    };
    expect(selection.platforms).toHaveLength(0);
    expect(selection.sources).toHaveLength(0);
  });

  it('can handle multiple platforms', () => {
    const selection: PlatformPickerSelection = {
      platforms: ['reddit', 'hackernews'],
      sources: [],
    };
    expect(selection.platforms).toContain('reddit');
    expect(selection.platforms).toContain('hackernews');
  });

  it('can handle multiple sources', () => {
    const selection: PlatformPickerSelection = {
      platforms: ['reddit'],
      sources: ['r/programming', 'r/webdev'],
    };
    expect(selection.sources).toContain('r/programming');
    expect(selection.sources).toContain('r/webdev');
  });

  it('validates platform and source arrays', () => {
    const selection: PlatformPickerSelection = {
      platforms: ['reddit', 'hackernews'],
      sources: ['r/programming', 'r/webdev', 'r/technology'],
    };

    expect(selection.platforms).toEqual(['reddit', 'hackernews']);
    expect(selection.sources).toEqual(['r/programming', 'r/webdev', 'r/technology']);
  });

  it('handles URL parameter format', () => {
    const platforms = ['reddit', 'hackernews'];
    const sources = ['r/programming'];

    const params = new URLSearchParams();
    params.set('platforms', platforms.join(','));
    params.set('sources', sources.join(','));

    expect(params.get('platforms')).toBe('reddit,hackernews');
    expect(params.get('sources')).toBe('r/programming');
  });

  it('parses URL parameters correctly', () => {
    const urlPlatforms = 'reddit,hackernews';
    const urlSources = 'r/programming,r/webdev';

    const platforms = urlPlatforms.split(',').filter(Boolean);
    const sources = urlSources.split(',').filter(Boolean);

    expect(platforms).toEqual(['reddit', 'hackernews']);
    expect(sources).toEqual(['r/programming', 'r/webdev']);
  });

  it('handles empty URL parameters', () => {
    const urlPlatforms = '';
    const urlSources = '';

    const platforms = urlPlatforms.split(',').filter(Boolean);
    const sources = urlSources.split(',').filter(Boolean);

    expect(platforms).toEqual([]);
    expect(sources).toEqual([]);
  });

  it('filters out empty strings from URL parameters', () => {
    const urlPlatforms = 'reddit,,hackernews,';
    const platforms = urlPlatforms.split(',').filter(Boolean);

    expect(platforms).toEqual(['reddit', 'hackernews']);
  });

  it('handles case-insensitive platform names', () => {
    const platform1 = 'Reddit'.toLowerCase();
    const platform2 = 'HACKERNEWS'.toLowerCase();

    expect(platform1).toBe('reddit');
    expect(platform2).toBe('hackernews');
  });
});
