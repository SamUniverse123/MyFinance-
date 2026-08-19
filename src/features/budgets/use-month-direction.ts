import { useRef, useState } from "react";

export type MonthDirection = "forward" | "backward" | null;

/**
 * Derives slide direction (grill Q2) by comparing `key` — typically the selected
 * month "YYYY-MM" — to its previous value, using React's render-time state-adjustment
 * pattern (comparing against a ref and conditionally calling `setState` during render)
 * so the direction is available in the very render where the value changes, with no
 * extra effect-driven flash. Direction is inferred from the value itself, not from
 * which arrow was clicked, so it's correct for any navigation source — the arrows,
 * browser back/forward, or a bookmarked link.
 *
 * Independent call sites watching the same `key` each derive their own direction, in
 * sync, without threading it through props — used standalone by `MonthTransition`,
 * `MonthToggle`'s label, and the trend chart's sliding window.
 */
export function useMonthDirection(key: string | undefined): MonthDirection {
	const prevRef = useRef(key);
	const [direction, setDirection] = useState<MonthDirection>(null);

	if (key !== undefined && key !== prevRef.current) {
		const next: MonthDirection =
			prevRef.current === undefined
				? null
				: key > prevRef.current
					? "forward"
					: "backward";
		prevRef.current = key;
		setDirection(next);
	}

	return direction;
}
