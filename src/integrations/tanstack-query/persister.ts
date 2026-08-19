import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
	persistQueryClientRestore,
	persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";
import type { QueryClient } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

/** IndexedDB key the serialized cache lives under. */
const PERSIST_KEY = "myfinance-query-cache";

/**
 * Cache-schema version. Bump this whenever a query's shape changes in a way that
 * would make an old persisted entry wrong to restore — mismatched busters are
 * discarded on restore rather than hydrated.
 */
const PERSIST_BUSTER = "v1";

/**
 * How long a persisted entry stays restorable. Must match the QueryClient's
 * `gcTime` (see root-provider) — an entry evicted from memory sooner than this
 * would never be there to persist in the first place.
 */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

/**
 * Wire the TanStack Query cache to IndexedDB. **Browser only** — call from a
 * `typeof window !== "undefined"` guard; there is no IndexedDB during SSR.
 *
 * Returns a promise that resolves once the persisted cache has been restored into
 * `queryClient`. The root route's `beforeLoad` awaits it so that an offline boot
 * (service worker serving the shell, no server round-trip) reads last-known data
 * from the cache instead of firing queries against an unreachable network first.
 * Restore uses `hydrate` internally, which keeps whichever copy of a query has the
 * newer `dataUpdatedAt`, so fresh SSR-hydrated data is never clobbered by an older
 * persisted copy.
 *
 * Also subscribes to the cache to keep persisting it as it changes.
 */
export function setupQueryPersistence(queryClient: QueryClient): Promise<void> {
	const persister = createAsyncStoragePersister({
		key: PERSIST_KEY,
		storage: {
			getItem: (key) => get(key),
			setItem: (key, value) => set(key, value),
			removeItem: (key) => del(key),
		},
	});

	const options = {
		queryClient,
		persister,
		maxAge: CACHE_MAX_AGE,
		buster: PERSIST_BUSTER,
	};

	// Start saving on every cache change, and kick off the initial restore.
	persistQueryClientSubscribe(options);
	// Never reject: a restore failure (IndexedDB blocked, corrupt entry) just means
	// no cached data — it must not throw into the root beforeLoad that awaits this.
	return persistQueryClientRestore(options).then(
		() => undefined,
		() => undefined,
	);
}
