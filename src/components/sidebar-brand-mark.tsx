import { useEffect, useRef, useState } from "react";
import { BrandMark } from "#/components/brand-mark";
import { useSidebar } from "#/components/ui/sidebar";

/** sessionStorage flag — set on the first app-shell mount of a session so the
 *  autoplay flourish fires once on entry but not on subsequent reloads (ADR-0016). */
const PLAYED_KEY = "denarii-brandmark-played";

/**
 * The sidebar's BrandMark: feeds it the live sidebar state (expanded vs. collapsed
 * icon rail) and drives the two non-hover triggers — a one-shot autoplay on the
 * first app-shell mount per session, and a replay on every sidebar toggle.
 */
export function SidebarBrandMark() {
	const { state } = useSidebar();
	const expanded = state === "expanded";

	const [autoPlay, setAutoPlay] = useState(false);
	const [signal, setSignal] = useState(0);

	// First app-shell mount this session → play once.
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (sessionStorage.getItem(PLAYED_KEY)) return;
		sessionStorage.setItem(PLAYED_KEY, "1");
		setAutoPlay(true);
	}, []);

	// Replay on sidebar toggle (state flips), skipping the initial render.
	// `state` is a deliberate trigger-only dependency (see the identical case in
	// brand-mark.tsx's playSignal effect).
	const firstState = useRef(true);
	// biome-ignore lint/correctness/useExhaustiveDependencies: state is a deliberate trigger-only dep.
	useEffect(() => {
		if (firstState.current) {
			firstState.current = false;
			return;
		}
		setSignal((s) => s + 1);
	}, [state]);

	return (
		<BrandMark
			expanded={expanded}
			autoPlay={autoPlay}
			playSignal={signal}
			size={40}
		/>
	);
}
