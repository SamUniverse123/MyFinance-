import { QueryClient } from "@tanstack/react-query";
import { CACHE_MAX_AGE, setupQueryPersistence } from "./persister";

/** The QueryClient, tuned for offline-first. Shared shape across SSR and client. */
function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// 'offlineFirst': attempt the network once, then fall straight back to
				// cached data when it fails. The default 'online' would instead *pause*
				// an uncached query while offline — a promise that never resolves, which
				// would hang our best-effort loaders (`prefetch`) indefinitely.
				networkMode: "offlineFirst",
				// An entry must outlive its staleness in memory to be worth persisting
				// and restoring across reloads — keep it as long as the persisted copy.
				gcTime: CACHE_MAX_AGE,
				staleTime: 30_000,
				retry: 1,
			},
			mutations: {
				networkMode: "offlineFirst",
			},
		},
	});
}

export function getContext() {
	const queryClient = createQueryClient();

	// Persist to IndexedDB on the client only — getContext also runs per-request
	// during SSR, where there is no window/IndexedDB. `restore` resolves once the
	// cached data is back in the client; the root route's beforeLoad awaits it so an
	// offline boot serves cached data instead of racing an unreachable network.
	const restore =
		typeof window !== "undefined"
			? setupQueryPersistence(queryClient)
			: Promise.resolve();

	return { queryClient, restore };
}

export default function TanstackQueryProvider() {}
