import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataManager } from './data-manager';
import { DEFAULT_SETTINGS, SETTINGS_KEYS } from '../shared/types';
import type { StorageManager } from './storage';

describe('DataManager', () => {
  let mockStorage: Partial<StorageManager>;
  let dataManager: DataManager;

  beforeEach(() => {
    mockStorage = {
      getAllSettings: vi.fn(),
      setSetting: vi.fn(),
      getSetting: vi.fn(),
      getSubreddit: vi.fn(),
      addSubreddit: vi.fn(),
      addPost: vi.fn(),
      getPostById: vi.fn(),
      countPostsBySubreddit: vi.fn(),
      deleteOldestPosts: vi.fn(),
      getPostsBySubreddit: vi.fn(),
      deletePost: vi.fn(),
    };

    dataManager = new DataManager(mockStorage as StorageManager);
  });

  describe('initializeSettings', () => {
    it('sets SIDEBAR_ALWAYS_VISIBLE default to false', async () => {
      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce({});

      await dataManager.initializeSettings();

      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
        DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]
      );
    });

    it('sets SIDEBAR_AUTO_OPEN default to false', async () => {
      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce({});

      await dataManager.initializeSettings();

      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
        DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]
      );
    });

    it('sets all default settings when storage is empty', async () => {
      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce({});

      await dataManager.initializeSettings();

      const defaultKeys = Object.keys(DEFAULT_SETTINGS);
      expect(mockStorage.setSetting).toHaveBeenCalledTimes(defaultKeys.length);

      // Verify each default setting was set
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        expect(mockStorage.setSetting).toHaveBeenCalledWith(key, value);
      }
    });

    it('preserves existing settings values', async () => {
      const existingSettings = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: true,
        [SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]: true,
        [SETTINGS_KEYS.DEFAULT_POST_LIMIT]: 5000,
      };

      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce(existingSettings);

      await dataManager.initializeSettings();

      // Should not overwrite existing settings
      expect(mockStorage.setSetting).not.toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
        expect.anything()
      );
      expect(mockStorage.setSetting).not.toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
        expect.anything()
      );
      expect(mockStorage.setSetting).not.toHaveBeenCalledWith(
        SETTINGS_KEYS.DEFAULT_POST_LIMIT,
        expect.anything()
      );
    });

    it('only sets missing settings', async () => {
      const existingSettings = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: true,
        // SIDEBAR_AUTO_OPEN is missing
      };

      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce(existingSettings);

      await dataManager.initializeSettings();

      // Should preserve existing SIDEBAR_ALWAYS_VISIBLE
      expect(mockStorage.setSetting).not.toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
        expect.anything()
      );

      // Should set missing SIDEBAR_AUTO_OPEN
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
        DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]
      );

      // Should set all other missing settings
      const allDefaultKeys = Object.keys(DEFAULT_SETTINGS);
      const existingKeys = Object.keys(existingSettings);
      const missingKeys = allDefaultKeys.filter((key) => !existingKeys.includes(key));

      expect(mockStorage.setSetting).toHaveBeenCalledTimes(missingKeys.length);
    });

    it('initializes with correct default values', async () => {
      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce({});

      await dataManager.initializeSettings();

      // Verify sidebar defaults are false
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
        false
      );
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
        false
      );

      // Verify post limit default
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.DEFAULT_POST_LIMIT,
        DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT]
      );

      // Verify time limit default
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS,
        DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS]
      );
    });

    it('handles partial existing settings correctly', async () => {
      const existingSettings = {
        [SETTINGS_KEYS.DEFAULT_POST_LIMIT]: 2000,
      };

      vi.mocked(mockStorage.getAllSettings!).mockResolvedValueOnce(existingSettings);

      await dataManager.initializeSettings();

      // Should not overwrite existing post limit
      const setSettingCalls = vi.mocked(mockStorage.setSetting!).mock.calls;
      const postLimitCalls = setSettingCalls.filter(
        (call) => call[0] === SETTINGS_KEYS.DEFAULT_POST_LIMIT
      );
      expect(postLimitCalls).toHaveLength(0);

      // Should set missing sidebar settings
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
        false
      );
      expect(mockStorage.setSetting).toHaveBeenCalledWith(
        SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
        false
      );
    });
  });

  describe('togglePin', () => {
    it('uses default settings when creating new subreddit', async () => {
      vi.mocked(mockStorage.getSubreddit!).mockResolvedValueOnce(null);
      vi.mocked(mockStorage.getSetting!)
        .mockResolvedValueOnce(DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT])
        .mockResolvedValueOnce(DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS]);

      await dataManager.togglePin('test');

      expect(mockStorage.getSetting).toHaveBeenCalledWith(SETTINGS_KEYS.DEFAULT_POST_LIMIT);
      expect(mockStorage.getSetting).toHaveBeenCalledWith(SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS);

      expect(mockStorage.addSubreddit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test',
          is_pinned: true,
          post_limit: DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT],
          time_limit_days: DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS],
        })
      );
    });

    it('returns true when pinning new subreddit', async () => {
      vi.mocked(mockStorage.getSubreddit!).mockResolvedValueOnce(null);
      vi.mocked(mockStorage.getSetting!)
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(null);

      const result = await dataManager.togglePin('test');

      expect(result).toBe(true);
    });

    it('toggles existing subreddit pin status', async () => {
      const existingSub = {
        name: 'test',
        display_name: 'r/test',
        is_pinned: false,
        post_limit: 1000,
        time_limit_days: null,
        post_count: 0,
        last_scraped_at: Date.now(),
        first_scraped_at: Date.now(),
        created_at: Date.now(),
      };

      vi.mocked(mockStorage.getSubreddit!).mockResolvedValueOnce(existingSub);

      const result = await dataManager.togglePin('test');

      expect(result).toBe(true);
      expect(mockStorage.addSubreddit).toHaveBeenCalledWith(
        expect.objectContaining({
          is_pinned: true,
        })
      );
    });
  });

  describe('isPinned', () => {
    it('returns false for non-existent subreddit', async () => {
      vi.mocked(mockStorage.getSubreddit!).mockResolvedValueOnce(null);

      const result = await dataManager.isPinned('test');

      expect(result).toBe(false);
    });

    it('returns true for pinned subreddit', async () => {
      const pinnedSub = {
        name: 'test',
        display_name: 'r/test',
        is_pinned: true,
        post_limit: 1000,
        time_limit_days: null,
        post_count: 0,
        last_scraped_at: Date.now(),
        first_scraped_at: Date.now(),
        created_at: Date.now(),
      };

      vi.mocked(mockStorage.getSubreddit!).mockResolvedValueOnce(pinnedSub);

      const result = await dataManager.isPinned('test');

      expect(result).toBe(true);
    });

    it('returns false for unpinned subreddit', async () => {
      const unpinnedSub = {
        name: 'test',
        display_name: 'r/test',
        is_pinned: false,
        post_limit: 1000,
        time_limit_days: null,
        post_count: 0,
        last_scraped_at: Date.now(),
        first_scraped_at: Date.now(),
        created_at: Date.now(),
      };

      vi.mocked(mockStorage.getSubreddit!).mockResolvedValueOnce(unpinnedSub);

      const result = await dataManager.isPinned('test');

      expect(result).toBe(false);
    });
  });
});
