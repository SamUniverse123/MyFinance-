import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import * as z from "zod";
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
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { Area, AreaChart } from "@/components/charts";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { SiteHeader } from "@/components/site-header";
import { StatCardArea } from "@/components/stat-card-area";
import { StatCardLine } from "@/components/stat-card-line";
import {
	accountsListOptions,
	useGetAccounts,
} from "@/features/accounts/queries";
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
});

export const Route = createFileRoute("/_app/dashboard/")({
	validateSearch: dashboardSearchSchema,
	loaderDeps: ({ search }) => ({ range: search.range }),
	loader: ({ context, deps }) =>
		Promise.all([
			context.queryClient.ensureQueryData(dashboardSummaryOptions(deps.range)),
			context.queryClient.ensureQueryData(accountsListOptions()),
			context.queryClient.ensureQueryData(transactionsListOptions()),
		]),
	component: DashboardPage,
});

/** minor units → display units (the stat cards/chart deal in whole currency amounts). */
function toMajor(minorUnits: number): number {
	return minorUnits / 100;
}

/** % change from the first point to the last — undefined when there's nothing to compare against. */
function calcTrend(series: { value: number }[]): number | undefined {
	const first = series[0]?.value;
	const last = series.at(-1)?.value;
	if (first === undefined || last === undefined || first === 0)
		return undefined;
	return ((last - first) / Math.abs(first)) * 100;
}

function PageShell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SiteHeader title="Dashboard" />
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
	const { range } = Route.useSearch();
	const navigate = Route.useNavigate();

	const {
		data: summary,
		isPending,
		isError,
		refetch,
	} = useGetDashboardSummary(range);
	const { data: accounts } = useGetAccounts();
	const { data: transactions } = useGetTransactions();

	if (isPending) {
		return (
			<PageShell>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<Skeleton className="h-48 rounded-xl" />
					<Skeleton className="h-48 rounded-xl" />
					<Skeleton className="h-48 rounded-xl" />
					<Skeleton className="h-48 rounded-xl" />
				</div>
				<Skeleton className="h-80 w-full rounded-xl" />
				<Skeleton className="h-64 w-full rounded-xl" />
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

	const moneyFormat = {
		style: "currency" as const,
		currency: summary.currency,
		maximumFractionDigits: 0,
	};

	const netWorthSeries = summary.netWorthSeries.map((d) => ({
		date: new Date(d.date),
		value: toMajor(d.value),
	}));
	const incomeSeries = summary.cashflow.map((d) => ({
		date: new Date(d.date),
		value: toMajor(d.income),
	}));
	const expenseSeries = summary.cashflow.map((d) => ({
		date: new Date(d.date),
		value: toMajor(d.expense),
	}));
	const cashflowSeries = summary.cashflow.map((d) => ({
		date: new Date(d.date),
		value: toMajor(d.income - d.expense),
	}));
	const chartData = summary.cashflow.map((d) => ({
		date: d.date,
		income: toMajor(d.income),
		expense: toMajor(d.expense),
	}));

	return (
		<PageShell>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCardArea
					title="Net worth"
					data={netWorthSeries}
					value={netWorthSeries.at(-1)?.value ?? 0}
					trend={calcTrend(netWorthSeries)}
					formatOptions={moneyFormat}
				/>
				<StatCardLine
					title="Income this month"
					data={incomeSeries}
					value={toMajor(summary.month.income)}
					formatOptions={moneyFormat}
				/>
				<StatCardLine
					title="Expenses this month"
					data={expenseSeries}
					value={toMajor(summary.month.expense)}
					formatOptions={moneyFormat}
				/>
				<StatCardArea
					title="Net cashflow"
					data={cashflowSeries}
					value={toMajor(summary.month.netCashflow)}
					trend={calcTrend(cashflowSeries)}
					formatOptions={moneyFormat}
				/>
			</div>

			{summary.otherCurrencies.length > 0 && (
				<p className="text-sm text-muted-foreground">
					Not counted above (different currency):{" "}
					{summary.otherCurrencies
						.map(
							(c) =>
								`${new Intl.NumberFormat(undefined, { style: "currency", currency: c.currency, maximumFractionDigits: 0 }).format(toMajor(c.amount))}`,
						)
						.join(" · ")}
				</p>
			)}

			<Card className="@container/card">
				<CardHeader>
					<CardTitle>Cashflow</CardTitle>
					<CardDescription className="flex items-center gap-4">
						<span className="flex items-center gap-1.5">
							<span
								className="size-2 rounded-full"
								style={{ backgroundColor: "var(--chart-1)" }}
							/>
							Income
						</span>
						<span className="flex items-center gap-1.5">
							<span
								className="size-2 rounded-full"
								style={{ backgroundColor: "var(--chart-2)" }}
							/>
							Expenses
						</span>
					</CardDescription>
					<ToggleGroup
						type="single"
						value={range}
						onValueChange={(next) => {
							if (next) navigate({ search: { range: next as Range } });
						}}
						variant="outline"
						className="*:data-[slot=toggle-group-item]:px-4!"
					>
						<ToggleGroupItem value="7d">7 days</ToggleGroupItem>
						<ToggleGroupItem value="30d">30 days</ToggleGroupItem>
						<ToggleGroupItem value="90d">90 days</ToggleGroupItem>
					</ToggleGroup>
				</CardHeader>
				<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
					<AreaChart aspectRatio="3 / 1" className="w-full" data={chartData}>
						<Grid />
						<XAxis />
						<ChartTooltip  className="bg-zinc-100" />
						<Area
							dataKey="income"
							stroke="var(--chart-1)"
							strokeWidth={2}
							showHighlight
						/>
						<Area
							dataKey="expense"
							stroke="var(--chart-2)"
							strokeWidth={2}
							showHighlight
						/>
					</AreaChart>
				</CardContent>
			</Card>

			<TransactionPreviewTable
				transactions={transactions ?? []}
				accounts={accounts ?? []}
			/>
		</PageShell>
	);
}
