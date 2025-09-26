'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

// Touch-friendly button with minimum 44px touch target
interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: ReactNode;
  haptic?: boolean;
}

export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      haptic = true,
      onClick,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback
      if (haptic && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
      onClick?.(e);
    };

    const sizeClasses = {
      sm: 'min-h-[40px] px-3 py-2 text-sm',
      md: 'min-h-[44px] px-4 py-2.5 text-base',
      lg: 'min-h-[52px] px-6 py-3 text-lg',
      icon: 'min-h-[44px] min-w-[44px] p-2.5',
    };

    const variantClasses = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
      outline:
        'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'touch-manipulation select-none',
          'active:scale-[0.98]',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TouchButton.displayName = 'TouchButton';

// Floating Action Button (FAB)
interface FABProps extends HTMLMotionProps<'button'> {
  icon: ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  extended?: boolean;
  mini?: boolean;
}

export function FAB({
  icon,
  label,
  position = 'bottom-right',
  extended = false,
  mini = false,
  className,
  ...props
}: FABProps) {
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        'fixed z-40 flex items-center justify-center gap-2',
        'bg-primary text-primary-foreground shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'touch-manipulation select-none',
        mini
          ? 'min-h-[40px] min-w-[40px] rounded-full p-2'
          : 'min-h-[56px] min-w-[56px] rounded-2xl p-4',
        extended && 'px-6',
        positionClasses[position],
        className
      )}
      {...props}
    >
      {icon}
      {extended && label && <span className="font-medium">{label}</span>}
    </motion.button>
  );
}

// Tab bar for mobile navigation
interface TabBarItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
}

interface TabBarProps {
  items: TabBarItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabBar({ items, activeId, onChange, className }: TabBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-around bg-background border-t',
        'safe-area-bottom',
        className
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2 px-3',
            'min-h-[56px] touch-manipulation transition-colors',
            activeId === item.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="relative">
            {item.icon}
            {item.badge && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center px-1">
                {item.badge}
              </span>
            )}
          </div>
          <span className="text-xs">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// Action sheet for mobile options
interface ActionSheetOption {
  id: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onClick: () => void;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
}

export function ActionSheet({
  isOpen,
  onClose,
  title,
  options,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl z-50 pb-safe"
      >
        {title && (
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-center">{title}</h3>
          </div>
        )}

        <div className="p-2">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                option.onClick();
                onClose();
              }}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-lg',
                'min-h-[56px] touch-manipulation transition-colors',
                'hover:bg-accent',
                option.destructive && 'text-destructive'
              )}
            >
              {option.icon}
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="p-2 border-t">
          <button
            onClick={onClose}
            className="w-full p-4 rounded-lg font-medium min-h-[56px] touch-manipulation hover:bg-accent transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// Touch ripple effect
interface RippleProps {
  color?: string;
  duration?: number;
}

export function Ripple({ color = 'rgba(255, 255, 255, 0.3)', duration = 600 }: RippleProps) {
  return (
    <span
      className="absolute inset-0 overflow-hidden rounded-inherit pointer-events-none"
      style={{ borderRadius: 'inherit' }}
    >
      <motion.span
        className="absolute rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: duration / 1000 }}
        style={{
          backgroundColor: color,
          width: '100%',
          height: '100%',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </span>
  );
}
