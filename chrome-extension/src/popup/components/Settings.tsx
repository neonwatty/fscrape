import { useState, useEffect } from 'react';
import { MessageType, SETTINGS_KEYS, DEFAULT_SETTINGS } from '../../shared/types';

interface SettingsData {
  sidebar_always_visible: boolean;
  sidebar_auto_open: boolean;
  default_post_limit: number;
  default_time_limit_days: number | null;
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>({
    sidebar_always_visible: DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE],
    sidebar_auto_open: DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN],
    default_post_limit: DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT],
    default_time_limit_days: DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS],
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load settings from background worker
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_SETTINGS,
      });

      if (response?.success) {
        const loadedSettings = response.data.settings;
        setSettings({
          sidebar_always_visible: loadedSettings[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE] ?? DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE],
          sidebar_auto_open: loadedSettings[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN] ?? DEFAULT_SETTINGS[SETTINGS_KEYS.SIDEBAR_AUTO_OPEN],
          default_post_limit: loadedSettings[SETTINGS_KEYS.DEFAULT_POST_LIMIT] ?? DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_POST_LIMIT],
          default_time_limit_days: loadedSettings[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS] ?? DEFAULT_SETTINGS[SETTINGS_KEYS.DEFAULT_TIME_LIMIT_DAYS],
        });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSidebar = async (value: boolean) => {
    try {
      console.log('Toggling sidebar to:', value);
      // Update local state
      setSettings(prev => ({ ...prev, sidebar_always_visible: value }));

      // Save via background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: {
          key: SETTINGS_KEYS.SIDEBAR_ALWAYS_VISIBLE,
          value,
        },
      });

      console.log('Update response:', response);

      if (response?.success) {
        // If enabling, open sidebar in current window (user gesture required)
        if (value) {
          try {
            const window = await chrome.windows.getCurrent();
            if (window.id) {
              await chrome.sidePanel.open({ windowId: window.id });
              console.log('Sidebar opened successfully');
            }
          } catch (err) {
            console.error('Failed to open sidebar:', err);
          }
        }

        // Show saved confirmation
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        console.error('Update failed:', response);
      }
    } catch (err) {
      console.error('Error updating sidebar setting:', err);
    }
  };

  const handleToggleAutoOpen = async (value: boolean) => {
    try {
      // Update local state
      setSettings(prev => ({ ...prev, sidebar_auto_open: value }));

      // Save via background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: {
          key: SETTINGS_KEYS.SIDEBAR_AUTO_OPEN,
          value,
        },
      });

      if (response?.success) {
        // Show saved confirmation
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Error updating auto-open setting:', err);
    }
  };

  const handlePostLimitChange = (value: number) => {
    // Handle NaN or invalid values - keep current value
    if (isNaN(value)) {
      return;
    }

    const limit = Math.max(100, Math.min(10000, value));
    // Update local state only
    setSettings(prev => ({ ...prev, default_post_limit: limit }));
  };

  const handlePostLimitBlur = async (value: number) => {
    try {
      // Handle NaN or invalid values
      if (isNaN(value)) {
        return;
      }

      const limit = Math.max(100, Math.min(10000, value));

      // Save via background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: {
          key: SETTINGS_KEYS.DEFAULT_POST_LIMIT,
          value: limit,
        },
      });

      if (response?.success) {
        // Show saved confirmation
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Error updating post limit:', err);
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="settings-loading">
          <div className="spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <h2 className="settings-title">⚙️ Settings</h2>
        {saved && <span className="save-indicator">✓ Saved</span>}
      </div>

      {/* Sidebar Settings Section */}
      <div className="settings-section">
        <h3 className="section-header">Dashboard Sidebar</h3>

        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="sidebar-visible" className="setting-label">
              Show sidebar permanently
            </label>
            <p className="setting-description">
              Keep the dashboard sidebar always visible on the right side of your browser
            </p>
          </div>
          <label className="toggle-switch">
            <input
              id="sidebar-visible"
              type="checkbox"
              checked={settings.sidebar_always_visible}
              onChange={(e) => handleToggleSidebar(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="sidebar-auto-open" className="setting-label">
              Auto-open sidebar on startup
            </label>
            <p className="setting-description">
              Automatically open the dashboard sidebar when you start your browser
            </p>
          </div>
          <label className="toggle-switch">
            <input
              id="sidebar-auto-open"
              type="checkbox"
              checked={settings.sidebar_auto_open}
              onChange={(e) => handleToggleAutoOpen(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="settings-section">
        <h3 className="section-header">Data Management</h3>

        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="post-limit" className="setting-label">
              Post limit per subreddit
            </label>
            <p className="setting-description">
              Maximum number of posts to keep for each subreddit (100-10,000)
            </p>
          </div>
          <input
            id="post-limit"
            type="number"
            min="100"
            max="10000"
            step="100"
            value={settings.default_post_limit}
            onChange={(e) => handlePostLimitChange(parseInt(e.target.value))}
            onBlur={(e) => handlePostLimitBlur(parseInt(e.target.value))}
            className="setting-input"
          />
        </div>
      </div>
    </div>
  );
}
