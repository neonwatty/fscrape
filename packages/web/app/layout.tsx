import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { FadeTransition } from '@/components/layout/PageTransition';
import { ThemeProvider, ThemeScript } from '@/components/providers/ThemeProvider';
import { ErrorBoundary } from '@/components/providers/ErrorBoundary';
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import './globals.css';

// Font loading with optimization
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'fscrape - Forum Data Analytics',
    template: '%s | fscrape',
  },
  description:
    'Comprehensive forum data scraping and analytics platform. Monitor discussions, track trends, and gain insights across multiple sources.',
  keywords: ['forum analytics', 'data scraping', 'trend analysis', 'discussion monitoring'],
  authors: [{ name: 'fscrape Team' }],
  creator: 'fscrape',
  publisher: 'fscrape',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'fscrape - Forum Data Analytics',
    description: 'Monitor discussions, track trends, and gain insights across multiple sources',
    url: '/',
    siteName: 'fscrape',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'fscrape',
    startupImage: [
      {
        url: '/startup/apple-touch-startup-image-768x1004.png',
        media: '(device-width: 768px) and (device-height: 1024px)',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased touch-manipulation`}>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Skip to main content
        </a>

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="fscrape-theme"
        >
          <ErrorBoundary>
            <AnalyticsProvider>
              <InstallPrompt />
              <div className="flex flex-col min-h-screen">
                <Header />

                <main id="main-content" className="flex-1 bg-background pb-20 md:pb-0" role="main">
                  <FadeTransition>{children}</FadeTransition>
                </main>

                <BottomNav />
              </div>
            </AnalyticsProvider>
          </ErrorBoundary>
        </ThemeProvider>

        {/* Accessibility announcement area for screen readers */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          id="announcements"
        />
      </body>
    </html>
  );
}
