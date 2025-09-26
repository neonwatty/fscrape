// Service Worker for FScrape PWA
// Version: 1.1.0

const CACHE_VERSION = '1.1.0';
const CACHE_NAME = `fscrape-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `fscrape-runtime-v${CACHE_VERSION}`;
const DATABASE_CACHE = `fscrape-db-v${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-maskable-192.svg',
  '/icon-maskable-512.svg',
  '/apple-touch-icon.svg',
  '/favicon.svg',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, fallback to network
  CACHE_FIRST: [
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i, // Images
    /\.(?:woff|woff2|ttf|otf|eot)$/i, // Fonts
    /\.(?:css)$/i, // Stylesheets
  ],
  // Network first, fallback to cache
  NETWORK_FIRST: [
    /\/api\//, // API routes
    /\.(?:json)$/i, // JSON data (except manifest)
    /\/database\.db$/i, // Database file
  ],
  // Stale while revalidate
  STALE_WHILE_REVALIDATE: [
    /\.(?:js)$/i, // JavaScript
    /\/_next\//, // Next.js assets
  ],
  // Cache only (for offline database)
  CACHE_ONLY: [
    /\/offline-db\.json$/i, // Offline database snapshot
  ],
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName !== CACHE_NAME &&
                cacheName !== RUNTIME_CACHE &&
                cacheName !== DATABASE_CACHE
              );
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Handle database requests specially
  if (request.url.includes('database.db')) {
    event.respondWith(handleDatabaseRequest(request));
    return;
  }

  // Determine caching strategy
  const strategy = getCacheStrategy(request.url);

  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request));
      break;
    case 'network-first':
      event.respondWith(networkFirst(request));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(request));
      break;
    case 'cache-only':
      event.respondWith(cacheOnly(request));
      break;
    default:
      event.respondWith(networkOnly(request));
  }
});

// Cache strategies implementation
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[Service Worker] Cache first fetch failed:', error);
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    throw error;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.error('[Service Worker] Stale while revalidate fetch failed:', error);
      return cached;
    });

  return cached || fetchPromise;
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    throw error;
  }
}

async function cacheOnly(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  // For cache-only strategy, return a 503 if not cached
  return new Response('Resource not available offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/plain',
    }),
  });
}

// Handle database requests with special caching
async function handleDatabaseRequest(request) {
  const cache = await caches.open(DATABASE_CACHE);

  try {
    // Try to fetch the latest database
    const response = await fetch(request);
    if (response.ok) {
      // Cache the database for offline use
      await cache.put(request, response.clone());
      console.log('[Service Worker] Database cached for offline use');
    }
    return response;
  } catch (error) {
    // If offline, try to serve cached database
    const cached = await cache.match(request);
    if (cached) {
      console.log('[Service Worker] Serving cached database');
      return cached;
    }

    // No cached database available
    console.error('[Service Worker] Database not available offline');
    return new Response('Database not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Determine cache strategy based on URL
function getCacheStrategy(url) {
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return strategy.toLowerCase().replace(/_/g, '-');
      }
    }
  }
  return 'network-only';
}

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.payload;
    caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(urlsToCache));
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
});

async function syncPosts() {
  try {
    // Implement sync logic here
    console.log('[Service Worker] Syncing posts...');
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.svg',
    badge: '/icon-72.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'view',
        title: 'View Update',
        icon: '/icon-96.svg',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification('Forum Scraper Update', options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle different notification actions
  if (event.action === 'view') {
    event.waitUntil(clients.openWindow('/'));
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(clients.openWindow('/'));
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Update critical resources
    await cache.addAll(STATIC_ASSETS);
    console.log('[Service Worker] Cache updated');
  } catch (error) {
    console.error('[Service Worker] Cache update failed:', error);
  }
}
