'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  name: string;
  href: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  className?: string;
  customItems?: BreadcrumbItem[];
  showHome?: boolean;
}

// Map of route segments to human-readable names
const routeNameMap: Record<string, string> = {
  posts: 'Posts',
  analytics: 'Analytics',
  compare: 'Compare Sources',
  settings: 'Settings',
  docs: 'Documentation',
  'api-docs': 'API Reference',
  about: 'About',
  blog: 'Blog',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const name =
      routeNameMap[segment] ||
      segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    breadcrumbs.push({
      name,
      href,
      current: index === segments.length - 1,
    });
  });

  return breadcrumbs;
}

export function Breadcrumbs({ className, customItems, showHome = true }: BreadcrumbsProps) {
  const pathname = usePathname();
  const items = customItems || generateBreadcrumbs(pathname);

  // Don't show breadcrumbs on home page unless custom items provided
  if (pathname === '/' && !customItems) {
    return null;
  }

  const allItems = showHome
    ? [{ name: 'Home', href: '/', current: pathname === '/' }, ...items]
    : items;

  return (
    <nav className={cn('flex items-center space-x-1 text-sm', className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {allItems.map((item, index) => (
          <Fragment key={item.href}>
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            <li className="flex items-center">
              {item.current ? (
                <span className="text-foreground font-medium" aria-current="page">
                  {item.name === 'Home' && showHome ? <Home className="h-4 w-4" /> : item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
                >
                  {item.name === 'Home' && showHome ? <Home className="h-4 w-4" /> : item.name}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

// Mobile-optimized breadcrumb component
export function MobileBreadcrumbs({ className, customItems }: BreadcrumbsProps) {
  const pathname = usePathname();
  const items = customItems || generateBreadcrumbs(pathname);

  if (pathname === '/' && !customItems) {
    return null;
  }

  // On mobile, show only current page and parent
  const displayItems =
    items.length > 1 ? [items[items.length - 2], items[items.length - 1]] : items;

  return (
    <nav className={cn('flex items-center space-x-1 text-xs', className)} aria-label="Breadcrumb">
      <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </Link>
      {displayItems.map((item, _index) => (
        <Fragment key={item.href}>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {item.current ? (
            <span className="text-foreground font-medium truncate max-w-[120px]">{item.name}</span>
          ) : (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
            >
              {item.name}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
