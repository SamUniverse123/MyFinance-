import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { MonthTransition } from "./month-transition";

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, {
	month: "long",
	year: "numeric",
});

/** "YYYY-MM" shifted by `delta` months, back to "YYYY-MM". */
function shiftMonth(month: string, delta: number): string {
	const [y, m] = month.split("-").map(Number);
	const d = new Date(y, m - 1 + delta, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-08" → "August 2026". */
export function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	if (!y || !m) return month;
	return MONTH_YEAR.format(new Date(y, m - 1, 1));
}

/**
 * `< August 2026 >` selector above the budget page (ADR-0015). Bounded left by the
 * earliest month with data in the selected currency and right by the current month —
 * no future budgets.
 */
export function MonthToggle({
	month,
	earliestMonth,
	currentMonth,
	onChange,
}: {
	month: string;
	earliestMonth: string;
	currentMonth: string;
	onChange: (month: string) => void;
}) {
	const canPrev = month > earliestMonth;
	const canNext = month < currentMonth;

	return (
		<div className="flex items-center justify-center gap-1">
			<Button
				variant="ghost"
				size="icon-sm"
				disabled={!canPrev}
				onClick={() => onChange(shiftMonth(month, -1))}
				aria-label="Previous month"
			>
				<ChevronLeft />
			</Button>
			<MonthTransition
				month={month}
				className="min-w-36 overflow-hidden text-center text-sm font-semibold tabular-nums"
			>
				{monthLabel(month)}
			</MonthTransition>
			<Button
				variant="ghost"
				size="icon-sm"
				disabled={!canNext}
				onClick={() => onChange(shiftMonth(month, 1))}
				aria-label="Next month"
			>
				<ChevronRight />
			</Button>
		</div>
	);
}
