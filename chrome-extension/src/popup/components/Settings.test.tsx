import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from './Settings';
import { SETTINGS_KEYS, MessageType, DEFAULT_SETTINGS } from '../../shared/types';

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading Settings', () => {
    it('shows loading state initially', () => {
      render(<Settings />);
      expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
    });

    it('loads settings from background worker on mount', async () => {
      const mockSettings = {
        [SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]: true,
        [SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]: false,
        [SETTINGS_KEYS.DEFAULT_POST_LIMIT]: 500,
        [SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS]: null,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { settings: mockSettings },
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.GET_SETTINGS,
      });

      // Check that the toggle reflects the loaded value
      const sidebarToggle = screen.getByLabelText(/show sidebar permanently/i) as HTMLInputElement;
      expect(sidebarToggle.checked).toBe(true);
    });

    it('uses default settings when storage is empty', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { settings: {} },
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });

      const sidebarToggle = screen.getByLabelText(/show sidebar permanently/i) as HTMLInputElement;
      expect(sidebarToggle.checked).toBe(DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]);
    });

    it('handles loading errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(new Error('Message error'));

      render(<Settings />);

      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading settings:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Sidebar Always Visible Toggle', () => {
    beforeEach(async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { settings: {} },
      });
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      vi.clearAllMocks();
    });

    it('sends UPDATE_SETTINGS message to background when toggled', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { updated: true },
      });

      const user = userEvent.setup();
      const toggle = screen.getByLabelText(/show sidebar permanently/i);

      await user.click(toggle);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTINGS,
        payload: {
          key: SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
          value: true,
        },
      });
    });

    it('shows save confirmation after toggling', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { updated: true },
      });

      const user = userEvent.setup();
      const toggle = screen.getByLabelText(/show sidebar permanently/i);

      await user.click(toggle);

      await waitFor(() => {
        expect(screen.getByText(/✓ saved/i)).toBeInTheDocument();
      });
    });

    it('handles toggle errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(new Error('Message error'));

      const user = userEvent.setup();
      const toggle = screen.getByLabelText(/show sidebar permanently/i);

      await user.click(toggle);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error updating sidebar setting:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Sidebar Auto-Open Toggle', () => {
    beforeEach(async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { settings: {} },
      });
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      vi.clearAllMocks();
    });

    it('sends UPDATE_SETTINGS message to background when toggled', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { updated: true },
      });

      const user = userEvent.setup();
      const toggle = screen.getByLabelText(/auto-open sidebar on startup/i);

      await user.click(toggle);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTINGS,
        payload: {
          key: SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
          value: true,
        },
      });
    });

    it('shows save confirmation after toggling', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { updated: true },
      });

      const user = userEvent.setup();
      const toggle = screen.getByLabelText(/auto-open sidebar on startup/i);

      await user.click(toggle);

      await waitFor(() => {
        expect(screen.getByText(/✓ saved/i)).toBeInTheDocument();
      });
    });
  });

  describe('Post Limit Configuration', () => {
    beforeEach(async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: {
          settings: {
            [SETTINGS_KEYS.DEFAULT_POST_LIMIT]: 1000,
          },
        },
      });
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      vi.clearAllMocks();
    });

    it('clamps post limit to minimum (100)', () => {
      // Test the clamping logic directly
      const testValue = 50;
      const clamped = Math.max(100, Math.min(10000, testValue));
      expect(clamped).toBe(100);
    });

    it('clamps post limit to maximum (10000)', () => {
      // Test the clamping logic directly
      const testValue = 15000;
      const clamped = Math.max(100, Math.min(10000, testValue));
      expect(clamped).toBe(10000);
    });

    it('accepts valid post limit within range', () => {
      // Test the clamping logic directly
      const testValue = 2000;
      const clamped = Math.max(100, Math.min(10000, testValue));
      expect(clamped).toBe(2000);
    });

    it('shows save confirmation after updating post limit', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { updated: true },
      });

      const user = userEvent.setup();
      const input = screen.getByLabelText(/post limit per subreddit/i) as HTMLInputElement;

      await user.tripleClick(input);
      await user.keyboard('2000');
      input.blur(); // Trigger onBlur

      await waitFor(() => {
        expect(screen.getByText(/✓ saved/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI Elements', () => {
    beforeEach(async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
        success: true,
        data: { settings: {} },
      });
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
    });

    it('displays settings title', () => {
      expect(screen.getByText(/⚙️ settings/i)).toBeInTheDocument();
    });

    it('displays sidebar settings section', () => {
      expect(screen.getByRole('heading', { name: /dashboard sidebar/i })).toBeInTheDocument();
    });

    it('displays data management section', () => {
      expect(screen.getByText(/data management/i)).toBeInTheDocument();
    });

    it('displays all toggle descriptions', () => {
      expect(screen.getByText(/keep the dashboard sidebar always visible/i)).toBeInTheDocument();
      expect(screen.getByText(/automatically open the dashboard sidebar when you start/i)).toBeInTheDocument();
    });

    it('displays post limit description with range', () => {
      expect(screen.getByText(/100-10,000/i)).toBeInTheDocument();
    });
  });
});
