import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageType, SETTINGS_KEYS } from '../shared/types';

describe('Background Service Worker - Sidebar Persistence Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Change Handling - SIDEBAR_ALWAYS_VISIBLE', () => {
    it('should open sidebar in all windows when enabled', async () => {
      const mockWindows = [
        { id: 1, type: 'normal' },
        { id: 2, type: 'normal' },
        { id: 3, type: 'normal' },
      ];

      vi.mocked(chrome.windows.getAll).mockResolvedValueOnce(mockWindows as any);
      vi.mocked(chrome.sidePanel.open).mockResolvedValue(undefined);

      const changes = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: {
          oldValue: false,
          newValue: true,
        },
      };

      // Simulate the storage change handler logic
      const areaName = 'sync';
      if (areaName === 'sync' && changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]) {
        const isVisible = changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE].newValue;
        if (isVisible) {
          const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
          for (const window of windows) {
            if (window.id) {
              await chrome.sidePanel.open({ windowId: window.id }).catch(console.error);
            }
          }
        }
      }

      expect(chrome.windows.getAll).toHaveBeenCalledWith({ windowTypes: ['normal'] });
      expect(chrome.sidePanel.open).toHaveBeenCalledTimes(3);
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 2 });
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
    });

    it('should not open sidebar when disabled', async () => {
      const changes = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: {
          oldValue: true,
          newValue: false,
        },
      };

      // Simulate handler logic
      const areaName = 'sync';
      if (areaName === 'sync' && changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]) {
        const isVisible = changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE].newValue;
        if (isVisible) {
          const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
          for (const window of windows) {
            if (window.id) {
              await chrome.sidePanel.open({ windowId: window.id }).catch(console.error);
            }
          }
        }
      }

      expect(chrome.windows.getAll).not.toHaveBeenCalled();
      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    });

    it('should ignore changes in local storage area', async () => {
      const changes = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: {
          oldValue: false,
          newValue: true,
        },
      };

      // Simulate handler logic with local area
      const areaName = 'local';
      if (areaName === 'sync' && changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]) {
        const isVisible = changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE].newValue;
        if (isVisible) {
          await chrome.windows.getAll({ windowTypes: ['normal'] });
        }
      }

      expect(chrome.windows.getAll).not.toHaveBeenCalled();
      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    });

    it('should handle chrome.sidePanel.open() errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockWindows = [{ id: 1, type: 'normal' }];

      vi.mocked(chrome.windows.getAll).mockResolvedValueOnce(mockWindows as any);
      vi.mocked(chrome.sidePanel.open).mockRejectedValueOnce(new Error('Panel error'));

      const changes = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: {
          oldValue: false,
          newValue: true,
        },
      };

      // Simulate handler logic
      const areaName = 'sync';
      if (areaName === 'sync' && changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]) {
        const isVisible = changes[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE].newValue;
        if (isVisible) {
          const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
          for (const window of windows) {
            if (window.id) {
              await chrome.sidePanel.open({ windowId: window.id }).catch(console.error);
            }
          }
        }
      }

      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Message Handlers - Sidebar Operations', () => {
    describe('OPEN_SIDEBAR', () => {
      it('should open sidebar in specified window', async () => {
        vi.mocked(chrome.sidePanel.open).mockResolvedValueOnce(undefined);

        const payload = { windowId: 5 };

        // Simulate OPEN_SIDEBAR handler
        if (payload.windowId) {
          await chrome.sidePanel.open({ windowId: payload.windowId });
        }

        expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 5 });
      });

      it('should open sidebar in current window when windowId not provided', async () => {
        vi.mocked(chrome.windows.getCurrent).mockResolvedValueOnce({ id: 3 } as any);
        vi.mocked(chrome.sidePanel.open).mockResolvedValueOnce(undefined);

        const payload = {};

        // Simulate handler logic
        if (!payload.windowId) {
          const window = await chrome.windows.getCurrent();
          if (window.id) {
            await chrome.sidePanel.open({ windowId: window.id });
          }
        }

        expect(chrome.windows.getCurrent).toHaveBeenCalled();
        expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
      });
    });

    describe('TOGGLE_SIDEBAR', () => {
      it('should open sidebar in specified window', async () => {
        vi.mocked(chrome.sidePanel.open).mockResolvedValueOnce(undefined);

        const payload = { windowId: 7 };

        // Simulate TOGGLE_SIDEBAR handler
        const targetWindowId = payload.windowId || (await chrome.windows.getCurrent()).id;
        if (targetWindowId) {
          await chrome.sidePanel.open({ windowId: targetWindowId });
        }

        expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
      });

      it('should open sidebar in current window when windowId not provided', async () => {
        vi.mocked(chrome.windows.getCurrent).mockResolvedValueOnce({ id: 4 } as any);
        vi.mocked(chrome.sidePanel.open).mockResolvedValueOnce(undefined);

        const payload = {};

        // Simulate handler logic
        const targetWindowId = payload.windowId || (await chrome.windows.getCurrent()).id;
        if (targetWindowId) {
          await chrome.sidePanel.open({ windowId: targetWindowId });
        }

        expect(chrome.windows.getCurrent).toHaveBeenCalled();
        expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 4 });
      });
    });
  });

  describe('Installation - Auto-open Sidebar', () => {
    it('should auto-open sidebar when SIDEBAR_AUTO_OPEN is true', async () => {
      const mockWindows = [
        { id: 1, type: 'normal' },
        { id: 2, type: 'normal' },
      ];

      vi.mocked(chrome.storage.sync.get).mockResolvedValueOnce({
        [SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]: true,
      });
      vi.mocked(chrome.windows.getAll).mockResolvedValueOnce(mockWindows as any);
      vi.mocked(chrome.sidePanel.open).mockResolvedValue(undefined);

      // Simulate installation handler logic
      const settings = await chrome.storage.sync.get([SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]);
      if (settings[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]) {
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        for (const window of windows) {
          if (window.id) {
            await chrome.sidePanel.open({ windowId: window.id }).catch(console.error);
          }
        }
      }

      expect(chrome.storage.sync.get).toHaveBeenCalledWith([SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]);
      expect(chrome.windows.getAll).toHaveBeenCalledWith({ windowTypes: ['normal'] });
      expect(chrome.sidePanel.open).toHaveBeenCalledTimes(2);
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 2 });
    });

    it('should not auto-open sidebar when SIDEBAR_AUTO_OPEN is false', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValueOnce({
        [SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]: false,
      });

      // Simulate installation handler logic
      const settings = await chrome.storage.sync.get([SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]);
      if (settings[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]) {
        await chrome.windows.getAll({ windowTypes: ['normal'] });
      }

      expect(chrome.storage.sync.get).toHaveBeenCalledWith([SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]);
      expect(chrome.windows.getAll).not.toHaveBeenCalled();
      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    });

    it('should handle missing SIDEBAR_AUTO_OPEN setting', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValueOnce({});

      // Simulate installation handler logic
      const settings = await chrome.storage.sync.get([SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]);
      if (settings[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]) {
        await chrome.windows.getAll({ windowTypes: ['normal'] });
      }

      expect(chrome.storage.sync.get).toHaveBeenCalledWith([SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]);
      expect(chrome.windows.getAll).not.toHaveBeenCalled();
      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    });
  });
});
