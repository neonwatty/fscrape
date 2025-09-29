'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';
import { Home, FileText, GitCompare, Search, Bell, Settings } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Posts', href: '/posts', icon: FileText },
  { name: 'Compare', href: '/compare', icon: GitCompare },
];

export function Header() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Left Section - Logo and Navigation */}
          <div className="flex items-center gap-4 sm:gap-8">
            {/* Mobile Menu */}
            <MobileNav />

            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-lg sm:text-xl font-bold hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
                F
              </div>
              <span className="hidden sm:inline">fscrape</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            {/* Search Button - Desktop */}
            <button
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-md hover:bg-muted transition-colors"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline">Search...</span>
              <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-50">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            {/* Notifications - Desktop */}
            <button
              className="relative p-2 rounded-md hover:bg-muted transition-colors hidden sm:block"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
            </button>

            {/* Settings - Desktop */}
            <Link
              href="/settings"
              className="p-2 rounded-md hover:bg-muted transition-colors hidden sm:block"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Version Badge - Desktop */}
            <div className="hidden lg:flex items-center ml-2 px-2 py-1 bg-muted rounded-md">
              <span className="text-xs text-muted-foreground">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
