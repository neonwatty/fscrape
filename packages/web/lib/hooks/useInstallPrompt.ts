'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * BeforeInstallPromptEvent interface for PWA installation
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Installation state interface
 */
export interface InstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isPending: boolean;
  platform: 'web' | 'ios' | 'android' | 'desktop' | null;
  displayMode: 'browser' | 'standalone' | 'minimal-ui' | 'fullscreen';
}

/**
 * Installation analytics data
 */
export interface InstallAnalytics {
  promptShown: number;
  promptDismissed: number;
  promptAccepted: number;
  lastPromptDate: string | null;
  installDate: string | null;
  platform: string | null;
}

/**
 * Hook configuration options
 */
export interface UseInstallPromptOptions {
  promptDelay?: number; // Delay before showing prompt (ms)
  reminderDelay?: number; // Days before showing prompt again after dismissal
  onInstall?: (analytics: InstallAnalytics) => void;
  onDismiss?: (analytics: InstallAnalytics) => void;
  onError?: (error: Error) => void;
  enableAnalytics?: boolean;
}

const ANALYTICS_KEY = 'pwa-install-analytics';
const DISMISS_KEY = 'pwa-install-dismissed';

/**
 * Custom hook for managing PWA installation prompts
 */
export function useInstallPrompt(options: UseInstallPromptOptions = {}) {
  const {
    promptDelay = 3000,
    reminderDelay = 7,
    onInstall,
    onDismiss,
    onError,
    enableAnalytics = true,
  } = options;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>({
    isInstallable: false,
    isInstalled: false,
    isPending: false,
    platform: null,
    displayMode: 'browser',
  });
  const [showPrompt, setShowPrompt] = useState(false);
  const [analytics, setAnalytics] = useState<InstallAnalytics>(() => {
    if (typeof window === 'undefined') {
      return {
        promptShown: 0,
        promptDismissed: 0,
        promptAccepted: 0,
        lastPromptDate: null,
        installDate: null,
        platform: null,
      };
    }

    const stored = localStorage.getItem(ANALYTICS_KEY);
    return stored
      ? JSON.parse(stored)
      : {
          promptShown: 0,
          promptDismissed: 0,
          promptAccepted: 0,
          lastPromptDate: null,
          installDate: null,
          platform: null,
        };
  });

  /**
   * Detect display mode
   */
  const getDisplayMode = useCallback((): InstallState['displayMode'] => {
    if (typeof window === 'undefined') return 'browser';

    if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
    return 'browser';
  }, []);

  /**
   * Detect platform
   */
  const detectPlatform = useCallback((): InstallState['platform'] => {
    if (typeof window === 'undefined') return null;

    const userAgent = window.navigator.userAgent.toLowerCase();

    // iOS detection
    if (/iphone|ipad|ipod/.test(userAgent) || (window.navigator as any).standalone) {
      return 'ios';
    }

    // Android detection
    if (/android/.test(userAgent)) {
      return 'android';
    }

    // Desktop detection
    if (/windows|mac|linux/.test(userAgent) && !/mobile/.test(userAgent)) {
      return 'desktop';
    }

    return 'web';
  }, []);

  /**
   * Check if app is installed
   */
  const checkInstallState = useCallback(() => {
    const displayMode = getDisplayMode();
    const platform = detectPlatform();

    // Check if running as installed PWA
    const isInstalled =
      displayMode === 'standalone' ||
      displayMode === 'fullscreen' ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setInstallState((prev) => ({
      ...prev,
      isInstalled,
      displayMode,
      platform,
    }));

    return isInstalled;
  }, [getDisplayMode, detectPlatform]);

  /**
   * Save analytics to localStorage
   */
  const saveAnalytics = useCallback(
    (data: InstallAnalytics) => {
      if (!enableAnalytics) return;

      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
      setAnalytics(data);
    },
    [enableAnalytics]
  );

  /**
   * Check if should show prompt
   */
  const shouldShowPrompt = useCallback((): boolean => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return true;

    const dismissedTime = parseInt(dismissed);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    return daysSinceDismissed > reminderDelay;
  }, [reminderDelay]);

  /**
   * Install the PWA
   */
  const install = useCallback(async () => {
    if (!deferredPrompt) {
      if (onError) {
        onError(new Error('No installation prompt available'));
      }
      return false;
    }

    setInstallState((prev) => ({ ...prev, isPending: true }));

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user choice
      const { outcome, platform } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        // Update analytics
        const updatedAnalytics: InstallAnalytics = {
          ...analytics,
          promptAccepted: analytics.promptAccepted + 1,
          installDate: new Date().toISOString(),
          platform,
        };
        saveAnalytics(updatedAnalytics);

        // Update state
        setInstallState((prev) => ({
          ...prev,
          isInstalled: true,
          isInstallable: false,
          isPending: false,
        }));

        // Call callback
        if (onInstall) {
          onInstall(updatedAnalytics);
        }

        setShowPrompt(false);
        setDeferredPrompt(null);
        return true;
      } else {
        // User dismissed
        const updatedAnalytics: InstallAnalytics = {
          ...analytics,
          promptDismissed: analytics.promptDismissed + 1,
          lastPromptDate: new Date().toISOString(),
        };
        saveAnalytics(updatedAnalytics);

        localStorage.setItem(DISMISS_KEY, Date.now().toString());

        if (onDismiss) {
          onDismiss(updatedAnalytics);
        }

        setShowPrompt(false);
        setInstallState((prev) => ({ ...prev, isPending: false }));
        return false;
      }
    } catch (error) {
      console.error('Installation error:', error);
      setInstallState((prev) => ({ ...prev, isPending: false }));

      if (onError) {
        onError(error as Error);
      }
      return false;
    }
  }, [deferredPrompt, analytics, saveAnalytics, onInstall, onDismiss, onError]);

  /**
   * Dismiss the prompt
   */
  const dismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());

    const updatedAnalytics: InstallAnalytics = {
      ...analytics,
      promptDismissed: analytics.promptDismissed + 1,
      lastPromptDate: new Date().toISOString(),
    };
    saveAnalytics(updatedAnalytics);

    if (onDismiss) {
      onDismiss(updatedAnalytics);
    }
  }, [analytics, saveAnalytics, onDismiss]);

  /**
   * Clear analytics data
   */
  const clearAnalytics = useCallback(() => {
    localStorage.removeItem(ANALYTICS_KEY);
    localStorage.removeItem(DISMISS_KEY);
    setAnalytics({
      promptShown: 0,
      promptDismissed: 0,
      promptAccepted: 0,
      lastPromptDate: null,
      installDate: null,
      platform: null,
    });
  }, []);

  /**
   * Initialize hook
   */
  useEffect(() => {
    // Check initial install state
    if (checkInstallState()) {
      return; // Already installed
    }

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setInstallState((prev) => ({ ...prev, isInstallable: true }));

      // Check if should show prompt
      if (shouldShowPrompt()) {
        // Update analytics
        const updatedAnalytics: InstallAnalytics = {
          ...analytics,
          promptShown: analytics.promptShown + 1,
          lastPromptDate: new Date().toISOString(),
        };
        saveAnalytics(updatedAnalytics);

        // Show prompt after delay
        setTimeout(() => setShowPrompt(true), promptDelay);
      }
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setInstallState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }));
      setShowPrompt(false);
      setDeferredPrompt(null);

      // Update analytics
      const updatedAnalytics: InstallAnalytics = {
        ...analytics,
        installDate: new Date().toISOString(),
        platform: detectPlatform(),
      };
      saveAnalytics(updatedAnalytics);
    };

    // Handle display mode change
    const handleDisplayModeChange = () => {
      checkInstallState();
    };

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayModeQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []); // Only run once on mount

  return {
    // State
    installState,
    showPrompt,
    analytics,
    deferredPrompt: !!deferredPrompt,

    // Actions
    install,
    dismiss,
    clearAnalytics,

    // Utilities
    checkInstallState,
    shouldShowPrompt,
  };
}
