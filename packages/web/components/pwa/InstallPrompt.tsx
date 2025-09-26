'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone, CheckCircle, Monitor, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useServiceWorker } from '@/lib/hooks/useServiceWorker';
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt';

export function InstallPrompt() {
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const { isSupported, isOnline, isUpdateAvailable, updateServiceWorker } = useServiceWorker();

  // Use the new install prompt hook
  const { installState, showPrompt, analytics, install, dismiss } = useInstallPrompt({
    promptDelay: 5000,
    reminderDelay: 7,
    onInstall: (analytics) => {
      console.log('PWA installed!', analytics);
    },
    onDismiss: (analytics) => {
      console.log('Install prompt dismissed', analytics);
    },
    enableAnalytics: true,
  });

  // Show update notification when update is available
  useEffect(() => {
    if (isUpdateAvailable) {
      setShowUpdateNotification(true);
    }
  }, [isUpdateAvailable]);

  const handleUpdate = () => {
    updateServiceWorker();
    setShowUpdateNotification(false);
  };

  // Get platform icon
  const getPlatformIcon = () => {
    switch (installState.platform) {
      case 'ios':
      case 'android':
        return <Smartphone className="h-5 w-5" />;
      case 'desktop':
        return <Monitor className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  // Don't render if not supported or already installed
  if (!isSupported || installState.isInstalled) {
    return null;
  }

  return (
    <>
      {/* Install Prompt Banner */}
      {showPrompt && installState.isInstallable && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
          <Alert className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-2xl">
            {getPlatformIcon()}
            <AlertDescription className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold text-lg mb-1">Install Forum Scraper</h3>
                <p className="text-sm opacity-90">
                  Get the full app experience with offline access and faster loading
                </p>
                {analytics.promptShown > 1 && (
                  <p className="text-xs opacity-75 mt-1">
                    You&apos;ve seen this {analytics.promptShown} times
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={install}
                  size="sm"
                  className="bg-white text-purple-600 hover:bg-gray-100"
                  disabled={installState.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {installState.isPending ? 'Installing...' : 'Install'}
                </Button>
                <Button
                  onClick={dismiss}
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  Not Now
                </Button>
              </div>

              {installState.platform === 'ios' && (
                <p className="text-xs opacity-75">
                  Tap share button and &quot;Add to Home Screen&quot;
                </p>
              )}
            </AlertDescription>

            <button
              onClick={dismiss}
              className="absolute top-2 right-2 text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        </div>
      )}

      {/* Update Notification */}
      {showUpdateNotification && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-down">
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertDescription className="flex flex-col gap-2">
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Update Available
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  A new version of the app is ready to install
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdate}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Update Now
                </Button>
                <Button onClick={() => setShowUpdateNotification(false)} size="sm" variant="ghost">
                  Later
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
          <p className="text-sm font-medium">You&apos;re offline - Some features may be limited</p>
        </div>
      )}
    </>
  );
}

// Mini install button for manual trigger
export function InstallButton() {
  const { installState, install, deferredPrompt } = useInstallPrompt({
    promptDelay: 0, // No delay for manual trigger
    enableAnalytics: true,
  });

  if (installState.isInstalled || !installState.isInstallable || !deferredPrompt) {
    return null;
  }

  return (
    <Button
      onClick={install}
      size="sm"
      variant="outline"
      className="gap-2"
      disabled={installState.isPending}
    >
      <Download className="h-4 w-4" />
      {installState.isPending ? 'Installing...' : 'Install App'}
    </Button>
  );
}

// Analytics display component
export function InstallAnalytics() {
  const { analytics, clearAnalytics } = useInstallPrompt();

  if (!analytics.promptShown && !analytics.installDate) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h3 className="font-semibold mb-2">Installation Analytics</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Prompts Shown:</div>
        <div>{analytics.promptShown}</div>
        <div>Prompts Accepted:</div>
        <div>{analytics.promptAccepted}</div>
        <div>Prompts Dismissed:</div>
        <div>{analytics.promptDismissed}</div>
        {analytics.installDate && (
          <>
            <div>Install Date:</div>
            <div>{new Date(analytics.installDate).toLocaleDateString()}</div>
          </>
        )}
        {analytics.platform && (
          <>
            <div>Platform:</div>
            <div className="capitalize">{analytics.platform}</div>
          </>
        )}
      </div>
      <Button onClick={clearAnalytics} size="sm" variant="outline" className="mt-3">
        Clear Analytics
      </Button>
    </div>
  );
}
