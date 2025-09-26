'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, Home, FileText, BarChart3, GitCompare } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Posts', href: '/posts', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Compare', href: '/compare', icon: GitCompare },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  // Update active index based on current pathname
  useEffect(() => {
    const index = navigation.findIndex((item) => item.href === pathname);
    if (index !== -1) {
      setActiveIndex(index);
    }
  }, [pathname]);

  // Close menu when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Toggle navigation menu"
          >
            <Menu className={cn('h-5 w-5 transition-all', open && 'rotate-90 opacity-0')} />
            <X className={cn('absolute h-5 w-5 transition-all', !open && 'rotate-90 opacity-0')} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] sm:w-[350px]">
          <SheetHeader>
            <SheetTitle className="text-left">Navigation</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'active:scale-[0.98] active:transition-transform',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                  {isActive && <div className="ml-auto h-2 w-2 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs text-muted-foreground">Data Explorer v1.0</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tap outside or swipe left to close
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
