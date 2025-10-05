import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Settings } from '../popup/components/Settings';
import { DEFAULT_SETTINGS, SETTINGS_KEYS, MessageType } from '../shared/types';

describe('Sidebar Persistence Smoke Tests', () => {
  describe('Settings Component', () => {
    it('renders without errors', async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { name: /dashboard sidebar/i })).toBeInTheDocument();
    });

    it('displays sidebar always visible toggle', async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/show sidebar permanently/i)).toBeInTheDocument();
    });

    it('displays sidebar auto-open toggle', async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/auto-open sidebar on startup/i)).toBeInTheDocument();
    });

    it('displays post limit configuration', async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/post limit per subreddit/i)).toBeInTheDocument();
    });
  });

  describe('Default Settings', () => {
    it('SIDEBAR_ALWAYS_VISIBLE default is false', () => {
      expect(DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE]).toBe(false);
    });

    it('SIDEBAR_AUTO_OPEN default is false', () => {
      expect(DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN]).toBe(false);
    });

    it('DEFAULT_POST_LIMIT is set', () => {
      expect(DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT]).toBeDefined();
      expect(typeof DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT]).toBe('number');
    });
  });

  describe('Message Types', () => {
    it('has OPEN_SIDEBAR message type', () => {
      expect(MessageType.OPEN_SIDEBAR).toBe('OPEN_SIDEBAR');
    });

    it('has CLOSE_SIDEBAR message type', () => {
      expect(MessageType.CLOSE_SIDEBAR).toBe('CLOSE_SIDEBAR');
    });

    it('has TOGGLE_SIDEBAR message type', () => {
      expect(MessageType.TOGGLE_SIDEBAR).toBe('TOGGLE_SIDEBAR');
    });
  });

  describe('Settings Keys', () => {
    it('has SIDEBAR_ALWAYS_VISIBLE key', () => {
      expect(SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE).toBe('sidebar_always_visible');
    });

    it('has SIDEBAR_AUTO_OPEN key', () => {
      expect(SETTINGS_KEYS.SIDEBAR_AUTO_OPEN).toBe('sidebar_auto_open');
    });
  });
});
