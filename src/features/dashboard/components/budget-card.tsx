import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { budgetStatus } from "@/features/budgets/budget-status";
import { cn } from "@/lib/utils.ts";

export type BudgetCardProps = {
	currency: string;
	/** This month's spending, in display units (positive). */
	spent: number;
	/** This month's income, in display units. */
	income: number;
	/** Monthly budget in display units, or null if unset. */
	budget: number | null;
};

/**
 * Dashboard's "Budget this month" glance card — read-only (ADR-0010): editing lives on
 * the dedicated budgets page, reached via the "View budgets" link. Shows spent-of-budget
 * with a progress bar (amber past 80%, red past 100%); with no budget set, falls back to
 * spending as a share of this month's income.
 */
export function BudgetCard({
	currency,
	spent,
	income,
	budget,
}: BudgetCardProps) {
	const money = (value: number) =>
		new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 0,
		}).format(value);

	const { hasBudget, pct, clampedPct, barColor } = budgetStatus(
		spent,
		budget,
		income,
	);
	const denominator = hasBudget ? (budget as number) : income;

	return (
		<Card className="flex h-full flex-col gap-0 py-0">
			<CardHeader className="px-5 py-4">
				<CardTitle>
					{hasBudget ? "Budget this month" : "Spending this month"}
				</CardTitle>
				<CardAction>
					<Button variant="ghost" size="sm" asChild>
						<Link to="/budgets" search={{ currency }}>
							View budgets
							<ChevronRight className="size-3.5" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col justify-between gap-4 px-5 pb-5">
				<div>
					<div className="text-3xl font-semibold tracking-tight tabular-nums">
						{money(spent)}
					</div>
					<div className="mt-1 text-sm text-muted-foreground">
						{hasBudget ? (
							<>of {money(budget as number)} budget</>
						) : income > 0 ? (
							<>{Math.round(pct)}% of income</>
						) : (
							<>spent so far</>
						)}
					</div>
				</div>

				{denominator > 0 && (
					<div className="flex flex-col gap-1.5">
						<div className="h-2 overflow-hidden rounded-full bg-muted">
							<div
								className={cn("h-full rounded-full transition-all", barColor)}
								style={{ width: `${clampedPct}%` }}
							/>
						</div>
						<div className="flex justify-between text-xs text-muted-foreground tabular-nums">
							<span>{Math.round(pct)}%</span>
							{hasBudget && (
								<span>
									{spent <= (budget as number)
										? `${money((budget as number) - spent)} left`
										: `${money(spent - (budget as number))} over`}
								</span>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
