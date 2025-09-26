'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({
  children,
  maxToasts = 5,
}: {
  children: React.ReactNode;
  maxToasts?: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        ...toast,
        id,
        dismissible: toast.dismissible !== false,
        position: toast.position || 'bottom-right',
      };

      setToasts((prev) => {
        // Limit number of toasts
        const updated = [...prev, newToast];
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      // Auto remove after duration
      if (toast.duration !== 0) {
        setTimeout(() => {
          removeToast(id);
        }, toast.duration || 5000);
      }
    },
    [maxToasts, removeToast]
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  // Group toasts by position
  const groupedToasts = toasts.reduce(
    (acc, toast) => {
      const position = toast.position || 'bottom-right';
      if (!acc[position]) acc[position] = [];
      acc[position].push(toast);
      return acc;
    },
    {} as Record<string, Toast[]>
  );

  const positionClasses = {
    'top-left': 'top-4 left-4 sm:top-6 sm:left-6',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 sm:top-6',
    'top-right': 'top-4 right-4 sm:top-6 sm:right-6',
    'bottom-left': 'bottom-4 left-4 sm:bottom-6 sm:left-6',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6',
    'bottom-right': 'bottom-4 right-4 sm:bottom-6 sm:right-6',
  };

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          className={cn(
            'fixed z-50 flex flex-col gap-2 pointer-events-none',
            positionClasses[position as keyof typeof positionClasses]
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {positionToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
      ))}
    </>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 150); // Wait for animation to complete
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <XCircle className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  };

  const colors = {
    success: 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100',
    error: 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100',
    warning: 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100',
    info: 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100',
  };

  const iconColors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const getAnimationClass = () => {
    const position = toast.position || 'bottom-right';
    if (position.includes('right')) {
      return isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';
    }
    if (position.includes('left')) {
      return isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0';
    }
    if (position.includes('top')) {
      return isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0';
    }
    return isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0';
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm sm:max-w-md rounded-lg border shadow-lg transition-all duration-150',
        colors[toast.type],
        getAnimationClass()
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 flex-shrink-0', iconColors[toast.type])}>
            {icons[toast.type]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium break-words">{toast.title}</h3>
            {toast.description && (
              <p className="mt-1 text-sm opacity-90 break-words">{toast.description}</p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded"
                aria-label={toast.action.label}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          {toast.dismissible !== false && (
            <button
              onClick={handleClose}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper hook for toast actions
export function useToastActions() {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string) => {
      addToast({ type: 'success', title, description });
    },
    error: (title: string, description?: string) => {
      addToast({ type: 'error', title, description });
    },
    warning: (title: string, description?: string) => {
      addToast({ type: 'warning', title, description });
    },
    info: (title: string, description?: string) => {
      addToast({ type: 'info', title, description });
    },
  };
}
