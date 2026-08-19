/*
 * Hand-rolled offline-first service worker.
 *
 * Why hand-rolled instead of vite-plugin-pwa: this app builds through TanStack
 * Start + Nitro, which emit the client assets to `.output/public` *after* Vite's
 * build phase. vite-plugin-pwa generated its `sw.js` into the wrong outDir (`dist`)
 * and precached zero assets, so it never got served. A static file in `public/` is
 * copied verbatim to `.output/public` and served at `/sw.js`, sidestepping the
 * build-integration mismatch entirely.
 *
 * Strategy (offline-first Tier 1):
 *   - navigations  → network-first, fall back to the last cached copy of that page.
 *   - static assets → stale-while-revalidate (instant from cache, refresh in bg).
 *   - /api/*        → left to the network; offline *data* is served from the
 *                     persisted TanStack Query cache (IndexedDB), not the SW.
 *
 * Caches are runtime-populated (cached on first online visit), not precached at
 * install — there's no build-generated precache manifest here. Bump VERSION when a
 * change should invalidate every cached page/asset; the activate handler purges
 * caches that don't match.
 */

const VERSION = "v1";
const PAGE_CACHE = `pages-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const CURRENT = new Set([PAGE_CACHE, ASSET_CACHE]);

self.addEventListener("install", () => {
	// Take over as soon as installed, rather than waiting for all tabs to close.
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			// Drop caches left over from a previous VERSION.
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((key) => !CURRENT.has(key)).map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	// Never touch writes — only GETs are safe to serve from cache.
	if (request.method !== "GET") return;

	const url = new URL(request.url);

	// Only our own origin; leave third-party requests (fonts CDN, logo.dev) alone.
	if (url.origin !== self.location.origin) return;

	// Data endpoints are handled by the persisted Query cache, not here. Caching
	// them in the SW too would double-cache and risk serving staler data.
	if (url.pathname.startsWith("/api/")) return;

	if (request.mode === "navigate") {
		event.respondWith(networkFirst(request, PAGE_CACHE));
		return;
	}

	if (
		["style", "script", "worker", "font", "image"].includes(request.destination)
	) {
		event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
	}
});

/** Prefer the network; on failure (offline) serve the last cached copy. */
async function networkFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	}
}

/** Serve cache immediately, refresh it in the background. */
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone());
			return response;
		})
		.catch(() => cached);
	return cached || network;
}
