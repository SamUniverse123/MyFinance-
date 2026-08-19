import { useEffect } from "react";

/**
 * Registers the offline-first service worker (`public/sw.js`) on the client.
 *
 * Rendered once from the root document. Registration is **production-only**: a SW
 * that caches navigations and assets fights Vite's dev server and HMR, so under
 * `vite dev` we skip it. Test offline against `pnpm build && pnpm start`.
 *
 * Renders nothing — it's a mount-time effect, not UI.
 */
export function RegisterSW() {
	useEffect(() => {
		if (!import.meta.env.PROD) return;
		if (!("serviceWorker" in navigator)) return;

		navigator.serviceWorker.register("/sw.js").catch((error) => {
			// A failed registration must never break the app — offline is an
			// enhancement, not a requirement.
			console.error("Service worker registration failed", error);
		});
	}, []);

	return null;
}
