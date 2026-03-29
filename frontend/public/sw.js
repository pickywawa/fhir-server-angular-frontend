const CACHE_NAME = 'healthapp-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.scss',
  '/manifest.json'
];

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
  
  // Ignorer les requêtes non-HTTP(S)
  if (!url.protocol.startsWith('http')) {
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
