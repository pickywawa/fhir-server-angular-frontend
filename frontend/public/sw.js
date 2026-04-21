const CACHE_NAME = 'healthapp-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.scss',
  '/manifest.json'
];

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Notification', body: event.data.text(), priority: 'LOW' };
  }

  console.debug('[SW:push]', { data });
    console.log('[SW:push] ▶ Push event received, notificationId:', data.notificationId, 'userId:', data.userId, 'priority:', data.priority);

  const title = data.title || 'HealthApp';
  const options = {
    body: data.body || data.message || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.notificationId || `push-${Date.now()}`,
    data: {
      notificationId: data.notificationId,
      userId: data.userId,
      priority: data.priority || 'LOW',
      url: data.url || '/'
    },
    requireInteraction: data.priority === 'CRITICAL' || data.priority === 'HIGH',
    silent: data.priority === 'LOW'
  };

  event.waitUntil(self.registration.showNotification(title, options));

  // Notify all open clients so they can display the in-app toast
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      console.debug('[SW:push] Posting to', clients.length, 'clients');
      console.log('[SW:push] Posting PUSH_NOTIFICATION to', clients.length, 'open client(s)');
      clients.forEach((client) => {
        client.postMessage({
          type: 'PUSH_NOTIFICATION',
          payload: {
            title,
            body: options.body,
            notificationId: data.notificationId,
            userId: data.userId,
            priority: data.priority || 'LOW',
            type: data.type,
            category: data.category,
            subcategory: data.subcategory,
            metadata: data.metadata || {}
          }
        });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationId = event.notification.data?.notificationId;
  const userId = event.notification.data?.userId;
  const targetUrl = event.notification.data?.url || '/';

  // Acknowledge the notification by posting to the app client
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          payload: { notificationId, userId }
        });
      });

      // Focus or open the app
      const focused = clients.find((c) => c.url.includes(self.location.origin) && 'focus' in c);
      if (focused) {
        return focused.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Failed to cache some assets:', err);
      });
    })
  );
  
  // Force le SW à devenir actif immédiatement
  self.skipWaiting();
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Prendre le contrôle des pages ouvertes immédiatement
  self.clients.claim();
});

// Fetch: stratégie Network-first pour API, Cache-first pour assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // In local development, never serve app bundles from SW cache to avoid stale code.
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }
  
  // Ignorer les requêtes non-HTTP(S)
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Ignorer les requêtes vers des domaines externes (ex: Jitsi, external APIs)
  if (url.origin !== self.location.origin) {
    console.log('[ServiceWorker] Skipping external domain:', url.origin);
    return;
  }
  
  // API requests: network first
  if (url.pathname.includes('/api') || url.pathname.includes('/fhir') || url.pathname.includes('/keycloak')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone et cache les bonnes réponses
          if (response.ok && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache si offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Offline page or default response
            if (request.destination === 'document') {
              return caches.match('/index.html').then((response) => {
                return response || new Response('Offline - Application unavailable');
              });
            }
            
            return new Response('Offline');
          });
        })
    );
    return;
  }
  
  // Static assets: cache first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((response) => {
        if (!response.ok) {
          return response;
        }
        
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        
        return response;
      });
    })
  );
});
