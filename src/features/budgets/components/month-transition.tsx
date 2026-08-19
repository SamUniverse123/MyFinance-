import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useMonthDirection } from "../use-month-direction";

const SLIDE_PX = 14;
const DURATION_S = 0.2;

/**
 * Direction-aware slide+fade wrapper (grill Q2/Q5) for a block of month-scoped
 * content — the overall-budget card's figures, the category-row list, the toggle's
 * own label. Keyed on `month`: the old content exits one way and the new content
 * enters from the other, derived from whether the month increased or decreased.
 * Independent per instance — each usage derives its own direction from the same
 * `month` value via `useMonthDirection`, so separate instances animate in sync
 * without threading direction through props. Not used for the ring chart (Q5, its
 * own internal tween runs undisturbed) or the trend chart (its own sliding window).
 */
export function MonthTransition({
	month,
	className,
	children,
}: {
	month: string;
	className?: string;
	children: React.ReactNode;
}) {
	const direction = useMonthDirection(month);
	const reduceMotion = useReducedMotion();
	const sign = direction === "backward" ? -1 : 1;

	if (reduceMotion) {
		// No transform/opacity choreography — content just swaps in place.
		return <div className={className}>{children}</div>;
	}

	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={month}
				className={className}
				initial={{ x: sign * SLIDE_PX, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				exit={{ x: sign * -SLIDE_PX, opacity: 0 }}
				transition={{ duration: DURATION_S, ease: "easeOut" }}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
}
