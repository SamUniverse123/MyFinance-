/**
 * Shared spent-vs-budget math for every budget surface (dashboard card, budgets page
 * overall, category rows, history chart). When a budget is set, progress warms to amber
 * past 80% and red past 100%; with no budget, spending shows as a share of income and
 * stays neutral emerald. All amounts in display units.
 */
export interface BudgetStatus {
	hasBudget: boolean;
	/** spent / denominator * 100, uncapped (can exceed 100). */
	pct: number;
	/** `pct` clamped to 100, for bar widths. */
	clampedPct: number;
	/** Tailwind background class for the progress bar / bar mark. */
	barColor: string;
}

export function budgetStatus(
	spent: number,
	budget: number | null,
	income = 0,
): BudgetStatus {
	const hasBudget = budget != null && budget > 0;
	const denominator = hasBudget ? budget : income;
	const pct = denominator > 0 ? (spent / denominator) * 100 : 0;
	const clampedPct = Math.min(pct, 100);
	const barColor =
		hasBudget && pct >= 100
			? "bg-red-500"
			: hasBudget && pct >= 80
				? "bg-amber-500"
				: "bg-emerald-500";
	return { hasBudget, pct, clampedPct, barColor };
}

/** SVG fill (CSS var) for each `barColor` class — for the history chart's rects. */
export const BUDGET_TONE_FILL: Record<string, string> = {
	"bg-emerald-500": "var(--color-emerald-500)",
	"bg-amber-500": "var(--color-amber-500)",
	"bg-red-500": "var(--color-red-500)",
};
