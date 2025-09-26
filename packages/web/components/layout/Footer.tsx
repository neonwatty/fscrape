'use client';

import Link from 'next/link';
import {
  Github,
  Twitter,
  Globe,
  Mail,
  ExternalLink,
  Heart,
  Code2,
  BookOpen,
  Shield,
  FileText,
  Activity,
} from 'lucide-react';

const footerLinks = {
  product: [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Posts', href: '/posts', icon: FileText },
    { name: 'Analytics', href: '/analytics', icon: Activity },
    { name: 'Compare', href: '/compare', icon: Code2 },
  ],
  resources: [
    { name: 'Documentation', href: '/docs', icon: BookOpen, external: false },
    { name: 'API Reference', href: '/api-docs', icon: Code2, external: false },
    { name: 'Changelog', href: '/changelog', icon: FileText, external: false },
    { name: 'System Status', href: '/status', icon: Shield, external: false },
  ],
  company: [
    { name: 'About', href: '/about', icon: Heart },
    { name: 'Blog', href: '/blog', icon: FileText },
    { name: 'Privacy', href: '/privacy', icon: Shield },
    { name: 'Terms', href: '/terms', icon: FileText },
  ],
};

const socialLinks = [
  {
    name: 'GitHub',
    href: 'https://github.com/yourusername/fscrape-frontend',
    icon: Github,
    ariaLabel: 'View source code on GitHub',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/fscrape',
    icon: Twitter,
    ariaLabel: 'Follow us on Twitter',
  },
  {
    name: 'Website',
    href: 'https://fscrape.com',
    icon: Globe,
    ariaLabel: 'Visit our website',
  },
  {
    name: 'Email',
    href: 'mailto:contact@fscrape.com',
    icon: Mail,
    ariaLabel: 'Send us an email',
  },
];

// Version and build information
const versionInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString().split('T')[0],
  environment: process.env.NODE_ENV || 'development',
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background" role="contentinfo" aria-label="Site footer">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Section */}
          <div className="col-span-2 md:col-span-1 lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 group"
              aria-label="fscrape home"
            >
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold group-hover:scale-110 transition-transform">
                F
              </div>
              <span className="text-xl font-bold">fscrape</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Comprehensive forum data scraping and analytics platform. Monitor discussions, track
              trends, and gain insights across multiple sources.
            </p>

            {/* Social Links */}
            <div className="mt-6 flex space-x-4" role="navigation" aria-label="Social media links">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                const isExternal = link.href.startsWith('http') || link.href.startsWith('mailto');

                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    aria-label={link.ariaLabel}
                    {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </div>

            {/* Version Info - Mobile/Tablet */}
            <div className="mt-6 flex flex-col gap-1 text-xs text-muted-foreground lg:hidden">
              <span>Version {versionInfo.version}</span>
              <span>Built {versionInfo.buildDate}</span>
            </div>
          </div>

          {/* Product Links */}
          <div role="navigation" aria-labelledby="product-heading">
            <h3 id="product-heading" className="font-semibold text-foreground">
              Product
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {footerLinks.product.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <Icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span>{link.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Resources Links */}
          <div role="navigation" aria-labelledby="resources-heading">
            <h3 id="resources-heading" className="font-semibold text-foreground">
              Resources
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {footerLinks.resources.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <Icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span>{link.name}</span>
                      {link.external && <ExternalLink className="h-3 w-3 opacity-50" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Company Links */}
          <div role="navigation" aria-labelledby="company-heading">
            <h3 id="company-heading" className="font-semibold text-foreground">
              Company
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {footerLinks.company.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <Icon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span>{link.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 border-t pt-8">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            {/* Copyright and Version Info */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-muted-foreground">
              <p>© {currentYear} fscrape. All rights reserved.</p>

              {/* Version Info - Desktop */}
              <div className="hidden lg:flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <Code2 className="h-3 w-3" />v{versionInfo.version}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span>Build {versionInfo.buildDate}</span>
                {versionInfo.environment === 'development' && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="text-amber-500 dark:text-amber-400">Dev Mode</span>
                  </>
                )}
              </div>
            </div>

            {/* Legal Links */}
            <nav
              className="flex flex-wrap justify-center gap-x-6 gap-y-2"
              role="navigation"
              aria-label="Legal information"
            >
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
              >
                <Shield className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
              >
                <FileText className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                Terms of Service
              </Link>
              <Link
                href="/cookies"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
              >
                <Shield className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                Cookie Policy
              </Link>
              <Link
                href="/sitemap"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
              >
                <Globe className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                Sitemap
              </Link>
            </nav>
          </div>

          {/* Accessibility Statement */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Built with <Heart className="inline h-3 w-3 text-red-500" aria-label="love" /> for
              data enthusiasts.{' '}
              <Link
                href="/accessibility"
                className="underline hover:text-foreground transition-colors"
              >
                Accessibility Statement
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
