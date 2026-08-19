import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import * as z from "zod";
import { prefetch } from "@/features/shared/http";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import { Candlestick, CandlestickChart } from "@/components/charts";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { CurrencyToggle } from "@/components/currency-toggle";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SiteHeader } from "@/components/site-header";
import {
	accountsListOptions,
	useGetAccounts,
} from "@/features/accounts/queries";
import { BudgetCard } from "@/features/dashboard/components/budget-card";
import { MonthlySpendingCalendar } from "@/features/dashboard/components/monthly-spending-calendar";
import { NetWorthHero } from "@/features/dashboard/components/net-worth-hero";
import {
	dashboardSummaryOptions,
	useGetDashboardSummary,
} from "@/features/dashboard/queries";
import { TransactionPreviewTable } from "@/features/transactions/components/transaction-preview-table";
import {
	transactionsListOptions,
	useGetTransactions,
} from "@/features/transactions/queries";

const RANGES = ["7d", "30d", "90d"] as const;
type Range = (typeof RANGES)[number];

const dashboardSearchSchema = z.object({
	range: z.enum(RANGES).default("30d").catch("30d"),
	// No default here — an absent/unrecognized currency falls back to the user's
	// default currency server-side (see dashboard.ts), which needs the account data
	// this page doesn't have client-side until the summary itself comes back.
	currency: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/dashboard/")({
	validateSearch: dashboardSearchSchema,
	loaderDeps: ({ search }) => ({
		range: search.range,
		currency: search.currency,
	}),
	loader: ({ context, deps }) =>
		prefetch(
			context.queryClient.ensureQueryData(
				dashboardSummaryOptions(deps.range, deps.currency),
			),
			context.queryClient.ensureQueryData(accountsListOptions()),
			context.queryClient.ensureQueryData(transactionsListOptions()),
		),
	component: DashboardPage,
});

/** minor units → display units (the cards/charts deal in whole currency amounts). */
function toMajor(minorUnits: number): number {
	return minorUnits / 100;
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
				breadcrumb={<PageBreadcrumb items={[{ label: "Dashboard" }]} />}
				actions={actions}
			/>
			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col">
					<div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
						{children}
					</div>
				</div>
			</div>
		</>
	);
}

function DashboardPage() {
	const { range, currency: currencyParam } = Route.useSearch();
	const navigate = Route.useNavigate();

	const {
		data: summary,
		isPending,
		isError,
		refetch,
	} = useGetDashboardSummary(range, currencyParam);
	const { data: accounts } = useGetAccounts();
	const { data: transactions } = useGetTransactions();

	if (isPending) {
		return (
			<PageShell>
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
					<Skeleton className="h-72 rounded-xl xl:col-span-3" />
					<Skeleton className="h-72 rounded-xl" />
				</div>
				<Skeleton className="h-80 w-full rounded-xl" />
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Skeleton className="h-72 rounded-xl" />
					<Skeleton className="h-72 rounded-xl" />
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
							<EmptyTitle>Couldn&apos;t load your dashboard</EmptyTitle>
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

	// Merge (not replace) search params — range and currency toggle independently
	// without clobbering each other.
	const setRange = (next: Range) =>
		navigate({ search: (prev) => ({ ...prev, range: next }) });
	const setCurrency = (next: string) =>
		navigate({ search: (prev) => ({ ...prev, currency: next }) });

	const netWorthSeries = summary.netWorthSeries.map((d) => ({
		date: new Date(d.date),
		value: toMajor(d.value),
	}));

	// Each day as a candle: open=0, close=net (income-expense), high=income (gross in),
	// low=-expense (gross out). Always a valid candle; wick = gross in/out, body = net,
	// colored green/red by sign.
	const candlestickData = summary.cashflow.map((d) => {
		const income = toMajor(d.income);
		const expense = toMajor(d.expense);
		return {
			date: new Date(d.date),
			open: 0,
			high: income,
			low: -expense,
			close: income - expense,
			income,
			expense,
		};
	});
	const moneyFmt = new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: summary.currency,
		maximumFractionDigits: 0,
	});

	return (
		<PageShell
			actions={
				<CurrencyToggle
					currencies={summary.availableCurrencies}
					value={summary.currency}
					onChange={setCurrency}
				/>
			}
		>
			{/* Top: net-worth hero (3/4) + budget card (1/4) */}
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
				<div className="xl:col-span-3">
					<NetWorthHero
						currency={summary.currency}
						netWorth={toMajor(summary.netWorth)}
						series={netWorthSeries}
						range={range}
						onRangeChange={setRange}
					/>
				</div>
				<BudgetCard
					currency={summary.currency}
					spent={toMajor(summary.month.expense)}
					income={toMajor(summary.month.income)}
					budget={summary.budget != null ? toMajor(summary.budget) : null}
				/>
			</div>

			{/* Middle: cashflow candlestick (driven by the hero's range toggle) */}
			<Card className="@container/card">
				<CardHeader>
					<CardTitle>Cashflow</CardTitle>
					<CardDescription className="flex items-center gap-4">
						<span className="flex items-center gap-1.5">
							<span
								className="size-2 rounded-full"
								style={{ backgroundColor: "var(--color-emerald-500)" }}
							/>
							Net positive
						</span>
						<span className="flex items-center gap-1.5">
							<span
								className="size-2 rounded-full"
								style={{ backgroundColor: "var(--color-red-500)" }}
							/>
							Net negative
						</span>
					</CardDescription>
				</CardHeader>
				<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
					<CandlestickChart
						aspectRatio="3 / 1"
						className="w-full"
						data={candlestickData}
					>
						<Grid />
						<XAxis />
						<ChartTooltip
							backgroundColor={"oklch(96.7% 0.001 286.375)"}
							rows={(point) => [
								{
									color: "var(--color-emerald-500)",
									label: "Income",
									value: moneyFmt.format(point.income as number),
								},
								{
									color: "var(--color-red-500)",
									label: "Expenses",
									value: moneyFmt.format(point.expense as number),
								},
								{
									color:
										(point.close as number) > 0
											? "var(--color-emerald-500)"
											: (point.close as number) < 0
												? "var(--color-red-500)"
												: "oklch(55.1% 0.027 264.364)",
									label: "Net",
									value: moneyFmt.format(point.close as number),
								},
							]}
						/>
						<Candlestick />
					</CandlestickChart>
				</CardContent>
			</Card>

			{/* Bottom: monthly spending calendar + recent transactions */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<MonthlySpendingCalendar
					transactions={transactions ?? []}
					currency={summary.currency}
				/>
				<TransactionPreviewTable
					transactions={(transactions ?? []).filter(
						(t) => t.currency === summary.currency,
					)}
					accounts={accounts ?? []}
				/>
			</div>
		</PageShell>
	);
}
