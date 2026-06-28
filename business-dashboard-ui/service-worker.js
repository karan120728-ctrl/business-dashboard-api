// ============================================================
// FlowOps Service Worker — Real Background Push Notifications
// ============================================================

const CACHE_NAME = 'flowops-cache-v1';

// Install & activate immediately
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

// ============================================================
// PUSH EVENT — This fires even when the browser tab is CLOSED
// ============================================================
self.addEventListener('push', (event) => {
    let data = { title: 'FlowOps', body: 'You have a new notification.' };
    
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch(e) {
        data.body = event.data ? event.data.text() : 'New notification received.';
    }

    const options = {
        body: data.body || data.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'flowops-notification',
        renotify: true,
        data: {
            url: data.url || '/dashboard.html'
        },
        actions: [
            { action: 'open', title: 'Open Dashboard' },
            { action: 'close', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ============================================================
// NOTIFICATION CLICK — Opens/focuses the app when user clicks
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const targetUrl = event.notification.data?.url || '/dashboard.html';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If dashboard is already open somewhere, focus it
            for (const client of clientList) {
                if (client.url.includes('dashboard') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a fresh tab
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
