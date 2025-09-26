'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  FileText,
  BarChart3,
  GitCompare,
  Settings,
  Search,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  HelpCircle,
  Users,
  Activity,
  TrendingUp,
  Database,
  Filter,
  Clock,
  Star,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  {
    name: 'Posts',
    href: '/posts',
    icon: FileText,
    children: [
      { name: 'All Posts', href: '/posts', icon: FileText },
      { name: 'Trending', href: '/posts/trending', icon: TrendingUp },
      { name: 'Recent', href: '/posts/recent', icon: Clock },
      { name: 'Starred', href: '/posts/starred', icon: Star },
    ],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    children: [
      { name: 'Overview', href: '/analytics', icon: Activity },
      { name: 'Sources', href: '/analytics/sources', icon: Database },
      { name: 'Filters', href: '/analytics/filters', icon: Filter },
    ],
  },
  { name: 'Compare', href: '/compare', icon: GitCompare },
];

const bottomNavigation: NavItem[] = [
  { name: 'Documentation', href: '/docs', icon: BookOpen },
  { name: 'Help & Support', href: '/support', icon: HelpCircle },
  { name: 'Community', href: '/community', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function Sidebar({ className, collapsible = true, defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-expand active sections
  useEffect(() => {
    const activeParent = navigation.find((item) =>
      item.children?.some((child) => pathname.startsWith(child.href))
    );
    if (activeParent) {
      setExpandedItems((prev) =>
        prev.includes(activeParent.name) ? prev : [...prev, activeParent.name]
      );
    }
  }, [pathname]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName) ? prev.filter((name) => name !== itemName) : [...prev, itemName]
    );
  };

  const filteredNavigation = navigation.filter((item) => {
    if (!searchQuery) return true;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const childrenMatch = item.children?.some((child) =>
      child.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesSearch || childrenMatch;
  });

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-background border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">fscrape</span>
          </Link>
        )}
        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'p-1.5 rounded-md hover:bg-muted transition-colors',
              collapsed && 'mx-auto'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search navigation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedItems.includes(item.name);
            const hasChildren = item.children && item.children.length > 0;
            const itemIsActive = isActive(item.href);

            return (
              <li key={item.name}>
                <div className="relative">
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      itemIsActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                      collapsed && 'justify-center'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span className="ml-auto bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        )}
                        {hasChildren && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleExpanded(item.name);
                            }}
                            className="ml-auto p-0.5 hover:bg-background/50 rounded"
                          >
                            <ChevronRight
                              className={cn(
                                'h-3 w-3 transition-transform',
                                isExpanded && 'rotate-90'
                              )}
                            />
                          </button>
                        )}
                      </>
                    )}
                  </Link>

                  {/* Child Navigation */}
                  {!collapsed && hasChildren && isExpanded && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon;
                        const childIsActive = isActive(child.href);

                        return (
                          <li key={child.name}>
                            <Link
                              href={child.href}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                                childIsActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              )}
                            >
                              <ChildIcon className="h-3 w-3" />
                              <span>{child.name}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t p-2">
        <ul className="space-y-1">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            const itemIsActive = isActive(item.href);

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    itemIsActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    collapsed && 'justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

// Mobile Sidebar with overlay
export function MobileSidebar({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Menu Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 p-3 bg-primary text-primary-foreground rounded-full shadow-lg md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed left-0 top-0 h-full w-72 bg-background z-50 transform transition-transform duration-300 md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="text-xl font-bold">fscrape</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Sidebar collapsible={false} className="border-0" />
      </div>
    </>
  );
}
