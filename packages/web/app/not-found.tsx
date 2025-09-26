'use client';

import Link from 'next/link';
import { FileQuestion, Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          {/* 404 Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="p-4 bg-muted rounded-full">
                <FileQuestion className="h-16 w-16 text-muted-foreground" />
              </div>
              <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-8 w-8 flex items-center justify-center">
                404
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Page Not Found</h1>
            <p className="text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>

          {/* Helpful Information */}
          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
            <h2 className="font-medium text-sm text-foreground">
              This might have happened because:
            </h2>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>The page has been moved or deleted</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>You may have mistyped the address</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>The link you followed may be outdated</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Link>
            <button
              onClick={() => window.history.back()}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          </div>

          {/* Search Suggestion */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">Looking for something specific?</p>
            <Link
              href="/search"
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <Search className="h-4 w-4 mr-1" />
              Try searching instead
            </Link>
          </div>

          {/* Popular Pages */}
          <div className="pt-4">
            <p className="text-sm font-medium text-foreground mb-3">Popular pages:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link
                href="/"
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/posts"
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
              >
                Posts
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/compare"
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
              >
                Compare
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
