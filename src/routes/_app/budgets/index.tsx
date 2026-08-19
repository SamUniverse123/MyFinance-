import { createFileRoute } from "@tanstack/react-router";
import { Pencil, TriangleAlert } from "lucide-react";
import { prefetch } from "@/features/shared/http";
import { useEffect, useState } from "react";
import * as z from "zod";
import { PageBreadcrumb } from "#/components/page-breadcrumb";
import { PageControls } from "#/components/page-controls";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import { CurrencyToggle } from "@/components/currency-toggle";
import { SiteHeader } from "@/components/site-header";
import { budgetStatus } from "@/features/budgets/budget-status";
import { CategoryBudgetRow } from "@/features/budgets/components/category-budget-row";
import { CategoryRingChart } from "@/features/budgets/components/category-ring-chart";
import {
	MonthToggle,
	monthLabel,
} from "@/features/budgets/components/month-toggle";
import { MonthTransition } from "@/features/budgets/components/month-transition";
import { SetBudgetDialog } from "@/features/budgets/components/set-budget-dialog";
import { SpendHistoryChart } from "@/features/budgets/components/spend-history-chart";
import { useUpdateBudget } from "@/features/budgets/mutations";
import {
	budgetsSummaryOptions,
	useGetBudgetSummary,
} from "@/features/budgets/queries";
import { usePagination } from "@/hooks/use-pagination";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

const CATEGORIES_PAGE_SIZE = 5;

const budgetsSearchSchema = z.object({
	// Absent/unrecognized currency falls back to the user's default server-side.
	currency: z.string().optional().catch(undefined),
	// Selected month (ADR-0015), "YYYY-MM". Absent/out-of-range → current month
	// (the server clamps into [earliestMonth, currentMonth]).
	month: z
		.string()
		.regex(/^\d{4}-\d{2}$/)
		.optional()
		.catch(undefined),
});

export const Route = createFileRoute("/_app/budgets/")({
	validateSearch: budgetsSearchSchema,
	loaderDeps: ({ search }) => ({
		currency: search.currency,
		month: search.month,
	}),
	loader: ({ context, deps }) =>
		prefetch(
			context.queryClient.ensureQueryData(
				budgetsSummaryOptions(deps.currency, deps.month),
			),
		),
	component: BudgetsPage,
});

/** minor units → display units, for the currency-formatting history chart. */
function toMajor(minor: number): number {
	return minor / 100;
}

function PageShell({
	children,
	actions,
}: {
	children: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<>
			<SiteHeader
				breadcrumb={<PageBreadcrumb items={[{ label: "Budgets" }]} />}
				actions={actions}
			/>
			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col">
					<div className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
						{children}
					</div>
				</div>
			</div>
		</>
	);
}

function BudgetsPage() {
	const { currency: currencyParam, month: monthParam } = Route.useSearch();
	const navigate = Route.useNavigate();

	const {
		data: summary,
		isPending,
		isError,
		refetch,
	} = useGetBudgetSummary(currencyParam, monthParam);
	const updateOverall = useUpdateBudget();
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	// Called unconditionally (before the isPending/isError early returns) per the
	// rules of hooks; `summary` isn't loaded yet on those paths, so this paginates
	// an empty list until it is and is recomputed once real categories arrive.
	const sortedCategories = summary?.categories.sort((category) =>
		category.budget ? -1 : 1,
	);

	const {
		page: categoryPage,
		setPage: setCategoryPage,
		totalPages: categoryTotalPages,
		pageItems: pagedCategories,
	} = usePagination(sortedCategories ?? [], CATEGORIES_PAGE_SIZE);

	// A category's budgeted-or-not status (and thus its sort position) can differ
	// month to month, so a page selected for one month may point at stale/empty
	// content in another — reset on every month change. Keyed off the raw URL param
	// (available before summary loads) rather than the resolved/clamped month, since
	// hooks must run unconditionally ahead of the isPending/isError early returns.
	// biome-ignore lint/correctness/useExhaustiveDependencies: setCategoryPage is a stable usePagination setter; biome can't see through the hook boundary and its own suggestion oscillates.
	useEffect(() => {
		setCategoryPage(1);
	}, [monthParam]);

	if (isPending) {
		return (
			<PageShell>
				<div className="flex flex-col gap-6">
					<Skeleton className="h-40 w-full rounded-xl" />
					<Skeleton className="h-56 w-full rounded-xl" />
					<Skeleton className="h-72 w-full rounded-xl" />
				</div>
			</PageShell>
		);
	}

	if (isError) {
		return (
			<PageShell>
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<TriangleAlert
								className="size-16 text-muted-foreground"
								strokeWidth={1.25}
							/>
							<EmptyTitle>Couldn&apos;t load your budgets</EmptyTitle>
							<EmptyDescription>
								Something went wrong reaching the server. Check your connection
								and try again.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center">
							<Button onClick={() => refetch()}>Try again</Button>
						</EmptyContent>
					</Empty>
				</div>
			</PageShell>
		);
	}

	const setCurrency = (next: string) =>
		navigate({ search: (prev) => ({ ...prev, currency: next }) });
	const setMonth = (next: string) =>
		navigate({
			// The current month is the default, so drop the param there for a clean URL.
			search: (prev) => ({
				...prev,
				month: next === summary.currentMonth ? undefined : next,
			}),
		});

	const { currency, overall, categories, history, month } = summary;
	const overallStatus = budgetStatus(overall.spent, overall.budget);
	const hasOverall = overall.budget != null;
	const isCurrentMonth = month === summary.currentMonth;
	// "spent so far this month" only makes sense for the ongoing month; a past month
	// shows the complete month's spend.
	const spentCaption = isCurrentMonth
		? "spent so far this month"
		: `spent in ${monthLabel(month)}`;

	// Shared hover between the ring chart and the category widgets (its legend).
	const budgetedCategories = categories.filter((c) => c.budget != null);

	return (
		<PageShell
			actions={
				summary.availableCurrencies.length > 1 ? (
					<CurrencyToggle
						currencies={summary.availableCurrencies}
						value={currency}
						onChange={setCurrency}
					/>
				) : undefined
			}
		>
			{/* Month selector above the content (ADR-0015). */}
			<div className="mb-6 flex justify-center">
				<MonthToggle
					month={month}
					earliestMonth={summary.earliestMonth}
					currentMonth={summary.currentMonth}
					onChange={setMonth}
				/>
			</div>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
				{/* Left column: overall budget over the spending trend (matches the sketch) */}
				<div className="flex flex-col gap-6">
					{/* Overall monthly budget for the selected currency */}
					<Card className="gap-0 py-0">
						<CardHeader className="flex flex-row items-start justify-between px-5 py-4">
							<CardTitle>{hasOverall ? "Budget" : "Spending"}</CardTitle>
							<SetBudgetDialog
								title={`${currency} budget — ${monthLabel(month)}`}
								description={`Sets the ${currency} budget from ${monthLabel(month)} onward, until you change it again.`}
								currency={currency}
								currentAmount={overall.budget}
								pending={updateOverall.isPending}
								onSubmit={(amount) =>
									updateOverall.mutateAsync({
										currency,
										input: { month, amount },
									})
								}
								trigger={
									<Button variant="ghost" size="sm">
										<Pencil className="size-3.5" />
										{hasOverall ? "Edit" : "Set budget"}
									</Button>
								}
							/>
						</CardHeader>
						<CardContent className="px-5 pb-5">
							<MonthTransition month={month} className="flex flex-col gap-4">
								<div>
									<div className="text-3xl font-semibold tracking-tight tabular-nums">
										{formatMoney(overall.spent, currency)}
									</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{hasOverall ? (
											<>
												of {formatMoney(overall.budget as number, currency)}{" "}
												budget
											</>
										) : (
											spentCaption
										)}
									</div>
								</div>

								{hasOverall && (
									<div className="flex flex-col gap-1.5">
										<div className="h-2 overflow-hidden rounded-full bg-muted">
											<div
												className={cn(
													"h-full rounded-full transition-all",
													overallStatus.barColor,
												)}
												style={{ width: `${overallStatus.clampedPct}%` }}
											/>
										</div>
										<div className="flex justify-between text-xs text-muted-foreground tabular-nums">
											<span>{Math.round(overallStatus.pct)}%</span>
											<span>
												{overall.spent <= (overall.budget as number)
													? `${formatMoney((overall.budget as number) - overall.spent, currency)} left`
													: `${formatMoney(overall.spent - (overall.budget as number), currency)} over`}
											</span>
										</div>
									</div>
								)}
							</MonthTransition>
						</CardContent>
					</Card>

					{/* 6-month spend history vs. the current budget */}
					<Card>
						<CardHeader>
							<CardTitle>Spending trend</CardTitle>
						</CardHeader>
						<CardContent>
							<SpendHistoryChart
								data={history.map((h) => ({
									month: h.month,
									spent: toMajor(h.spent),
									// Per-month effective budget — the reference line steps to match
									// history (ADR-0015 / grill Q6).
									budget: h.budget != null ? toMajor(h.budget) : null,
								}))}
								currency={currency}
							/>
						</CardContent>
					</Card>
				</div>

				{/* Right column: categories ring chart + widgets */}
				<Card className="gap-0 py-0">
					<CardHeader className="px-4 py-3">
						<CardTitle>Categories</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						{categories.length === 0 ? (
							<Empty className="py-10">
								<EmptyHeader>
									<EmptyTitle className="text-base">
										No expense categories yet
									</EmptyTitle>
									<EmptyDescription>
										Create top-level expense categories to budget them here.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<>
								{budgetedCategories.length > 0 && (
									<div className="border-b p-5 ">
										<CategoryRingChart
											categories={budgetedCategories}
											currency={currency}
											totalSpent={overall.spent}
											hoveredId={hoveredId}
											onHoverChange={setHoveredId}
										/>
									</div>
								)}
								<MonthTransition month={month} className="divide-y">
									{pagedCategories.map((category) => (
										<CategoryBudgetRow
											key={category.id}
											category={category}
											currency={currency}
											month={month}
											highlighted={hoveredId === category.id}
											dimmed={hoveredId != null && hoveredId !== category.id}
											onHover={(hovered) =>
												setHoveredId(hovered ? category.id : null)
											}
										/>
									))}
								</MonthTransition>
								{categoryTotalPages > 1 && (
									<div className="border-t px-4 py-3">
										<PageControls
											page={categoryPage}
											totalPages={categoryTotalPages}
											onPageChange={setCategoryPage}
										/>
									</div>
								)}
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
