import { Pencil } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	getCategoryColor,
	getCategoryIconMeta,
} from "#/features/categories/category-visuals";
import { formatMoney } from "#/lib/currency";
import { cn } from "#/lib/utils";
import type { BudgetCategory } from "../api";
import { budgetStatus } from "../budget-status";
import { useUpdateCategoryBudget } from "../mutations";
import { SetBudgetDialog } from "./set-budget-dialog";

/** One top-level expense category: spend, its budget bar (or a "Set budget" CTA), and
 *  the edit dialog. Amounts are minor units throughout (budgetStatus is unit-agnostic).
 *
 *  Doubles as the ring chart's legend: `onHover` reports hover to the parent, and
 *  `highlighted`/`dimmed` mirror the ring's spotlight-one / fade-the-rest behavior so
 *  the two feel like one control (ADR-0010). */
export function CategoryBudgetRow({
	category,
	currency,
	month,
	highlighted = false,
	dimmed = false,
	onHover,
}: {
	category: BudgetCategory;
	currency: string;
	/** Selected month "YYYY-MM"; edits apply from this month onward (ADR-0015). */
	month: string;
	highlighted?: boolean;
	dimmed?: boolean;
	onHover?: (hovered: boolean) => void;
}) {
	const meta = getCategoryIconMeta(category.icon);
	const Icon = meta.icon;
	const color = getCategoryColor(category.color);
	const update = useUpdateCategoryBudget();

	const hasBudget = category.budget != null;
	const status = budgetStatus(category.spent, category.budget);

	return (
		<div
			className={cn(
				"flex flex-col gap-2 px-4 py-3.5 transition-all duration-150",
				highlighted && "bg-muted/40",
				dimmed && "opacity-50",
			)}
			onMouseEnter={() => onHover?.(true)}
			onMouseLeave={() => onHover?.(false)}
		>
			<div className="flex items-center gap-3">
				<span
					className="flex size-9 shrink-0 items-center justify-center rounded-lg"
					style={{ color, backgroundColor: `${color}1f` }}
				>
					<Icon className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="truncate text-sm font-medium">{category.name}</div>
					<div className="text-xs text-muted-foreground tabular-nums">
						{formatMoney(category.spent, currency)}
						{hasBudget ? (
							<> of {formatMoney(category.budget as number, currency)}</>
						) : (
							" spent"
						)}
					</div>
				</div>
				<SetBudgetDialog
					title={`${category.name} budget (${currency})`}
					description={`Monthly spending limit for ${category.name} in ${currency}. Leave blank to remove it.`}
					currency={currency}
					currentAmount={category.budget}
					pending={update.isPending}
					onSubmit={(amount) =>
						update.mutateAsync({
							categoryId: category.id,
							input: { currency, month, amount },
						})
					}
					trigger={
						<Button variant="ghost" size="sm">
							<Pencil className="size-3.5" />
							{hasBudget ? "" : "Set budget"}
						</Button>
					}
				/>
			</div>

			{hasBudget && (
				<div className="flex flex-col gap-1 pl-12">
					<div className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								status.barColor,
							)}
							style={{ width: `${status.clampedPct}%` }}
						/>
					</div>
					<div className="flex justify-between text-xs text-muted-foreground tabular-nums">
						<span>{Math.round(status.pct)}%</span>
						<span>
							{category.spent <= (category.budget as number)
								? `${formatMoney((category.budget as number) - category.spent, currency)} left`
								: `${formatMoney(category.spent - (category.budget as number), currency)} over`}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
