'use client';

import { useCallback, useRef } from 'react';
import { useToast as useToastContext, type Toast } from '@/components/ui/toast';

export type { Toast } from '@/components/ui/toast';

interface ToastOptions extends Omit<Toast, 'id' | 'type' | 'title'> {
  title: string;
  type?: Toast['type'];
}

interface ToastPromiseOptions<T = any> {
  loading: string;
  success: (data: T) => string | { title: string; description?: string };
  error: (error: Error) => string | { title: string; description?: string };
}

/**
 * Enhanced toast hook with additional utilities
 */
export function useToast() {
  const context = useToastContext();
  const toastIdRef = useRef<string | undefined>(undefined);

  /**
   * Show a toast and return its ID for later updates
   */
  const show = useCallback(
    (options: ToastOptions): string => {
      const { title, type = 'info', ...rest } = options;
      const id = Math.random().toString(36).substring(2, 9);

      context.addToast({
        ...rest,
        type,
        title,
      });

      return id;
    },
    [context]
  );

  /**
   * Update an existing toast by ID
   */
  const update = useCallback(
    (id: string, options: Partial<Toast>) => {
      // Remove old toast and add updated one
      context.removeToast(id);
      context.addToast({
        ...options,
        type: options.type || 'info',
        title: options.title || 'Updated',
      });
    },
    [context]
  );

  /**
   * Toast helpers for common scenarios
   */
  const success = useCallback(
    (title: string, description?: string, options?: Partial<Toast>) => {
      return show({ ...options, title, description, type: 'success' });
    },
    [show]
  );

  const error = useCallback(
    (title: string, description?: string, options?: Partial<Toast>) => {
      return show({ ...options, title, description, type: 'error' });
    },
    [show]
  );

  const warning = useCallback(
    (title: string, description?: string, options?: Partial<Toast>) => {
      return show({ ...options, title, description, type: 'warning' });
    },
    [show]
  );

  const info = useCallback(
    (title: string, description?: string, options?: Partial<Toast>) => {
      return show({ ...options, title, description, type: 'info' });
    },
    [show]
  );

  /**
   * Loading toast that can be updated
   */
  const loading = useCallback(
    (title: string, description?: string): (() => void) => {
      const id = show({
        title,
        description,
        type: 'info',
        duration: 0, // Don't auto-dismiss
        dismissible: false,
      });

      toastIdRef.current = id;

      // Return dismiss function
      return () => context.removeToast(id);
    },
    [show, context]
  );

  /**
   * Promise toast - shows loading, then success/error based on promise resolution
   */
  const promise = useCallback(
    async <T>(promise: Promise<T>, options: ToastPromiseOptions<T>): Promise<T> => {
      // Show loading toast
      const dismiss = loading(options.loading);

      try {
        const result = await promise;
        dismiss();

        // Show success toast
        const successMessage = options.success(result);
        if (typeof successMessage === 'string') {
          success(successMessage);
        } else {
          success(successMessage.title, successMessage.description);
        }

        return result;
      } catch (err) {
        dismiss();

        // Show error toast
        const errorMessage = options.error(err as Error);
        if (typeof errorMessage === 'string') {
          error(errorMessage);
        } else {
          error(errorMessage.title, errorMessage.description);
        }

        throw err;
      }
    },
    [loading, success, error]
  );

  /**
   * Confirmation toast with action
   */
  const confirm = useCallback(
    (
      title: string,
      options: {
        description?: string;
        confirmLabel?: string;
        onConfirm: () => void | Promise<void>;
        type?: Toast['type'];
      }
    ) => {
      const { description, confirmLabel = 'Confirm', onConfirm, type = 'warning' } = options;

      show({
        title,
        description,
        type,
        action: {
          label: confirmLabel,
          onClick: onConfirm,
        },
        duration: 10000, // Longer duration for confirmations
      });
    },
    [show]
  );

  /**
   * Custom toast with full control
   */
  const custom = useCallback(
    (options: ToastOptions) => {
      return show(options);
    },
    [show]
  );

  /**
   * Dismiss a specific toast or all toasts
   */
  const dismiss = useCallback(
    (id?: string) => {
      if (id) {
        context.removeToast(id);
      } else {
        context.clearToasts();
      }
    },
    [context]
  );

  return {
    // Context methods
    ...context,

    // Enhanced methods
    show,
    update,
    success,
    error,
    warning,
    info,
    loading,
    promise,
    confirm,
    custom,
    dismiss,
  };
}

/**
 * Singleton toast for use outside React components
 */
class ToastManager {
  private static instance: ToastManager;
  private toastQueue: ToastOptions[] = [];
  private addToastFn: ((toast: Omit<Toast, 'id'>) => void) | null = null;

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  setAddToastFn(fn: (toast: Omit<Toast, 'id'>) => void) {
    this.addToastFn = fn;
    // Process any queued toasts
    this.processQueue();
  }

  private processQueue() {
    if (!this.addToastFn) return;

    while (this.toastQueue.length > 0) {
      const options = this.toastQueue.shift();
      if (options) {
        this.show(options);
      }
    }
  }

  show(options: ToastOptions) {
    const { title, type = 'info', ...rest } = options;
    const toast: Omit<Toast, 'id'> = { ...rest, type, title };

    if (this.addToastFn) {
      this.addToastFn(toast);
    } else {
      // Queue toast if provider not ready
      this.toastQueue.push(options);
    }
  }

  success(title: string, description?: string) {
    this.show({ title, description, type: 'success' });
  }

  error(title: string, description?: string) {
    this.show({ title, description, type: 'error' });
  }

  warning(title: string, description?: string) {
    this.show({ title, description, type: 'warning' });
  }

  info(title: string, description?: string) {
    this.show({ title, description, type: 'info' });
  }
}

// Export singleton instance
export const toast = ToastManager.getInstance();
