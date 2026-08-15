import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown, TriangleAlert } from "lucide-react";
import * as z from "zod";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import { AddAccount } from "#/features/accounts/components/add-account";
import {
	accountsListOptions,
	useGetAccounts,
} from "#/features/accounts/queries";
import {
	categoriesListOptions,
	useGetCategories,
} from "#/features/categories/queries";
import { AddTransaction } from "#/features/transactions/components/add-transaction";
import { TransactionsList } from "#/features/transactions/components/transactions-list";
import { TransactionsSummary } from "#/features/transactions/components/transactions-summary";
import { TransactionsTable } from "#/features/transactions/components/transactions-table";
import {
	transactionsListOptions,
	useGetTransactions,
} from "#/features/transactions/queries";
import { inferBaseCurrency, orderCurrencies } from "#/lib/currency";
import { CurrencyToggle } from "@/components/currency-toggle";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SiteHeader } from "@/components/site-header";
import { useGetSettings } from "@/features/settings/queries";

const transactionsSearchSchema = z.object({
	// No default — an absent/unrecognized currency falls back to the same
	// baseCurrency-or-most-common-account rule the dashboard uses.
	currency: z.string().optional().catch(undefined),
	// list = past-week preview (default); table = full-history table (ADR-0011).
	view: z.enum(["list", "table"]).optional().catch(undefined),
});

/** Start of the rolling 7-day window (today + 6 prior days), as a local `YYYY-MM-DD`. */
function pastWeekCutoff(): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - 6);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const Route = createFileRoute("/_app/transactions/")({
	validateSearch: transactionsSearchSchema,
	// The rows need account + category data to render; prefetch all three.
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(transactionsListOptions()),
			context.queryClient.ensureQueryData(accountsListOptions()),
			context.queryClient.ensureQueryData(categoriesListOptions()),
		]),
	component: TransactionsPage,
});

function PageShell({
	actions,
	children,
}: {
	actions?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<>
			<SiteHeader
				breadcrumb={<PageBreadcrumb items={[{ label: "Transactions" }]} />}
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

function TransactionsPage() {
	const { currency: currencyParam, view: viewParam } = Route.useSearch();
	const navigate = Route.useNavigate();
	const transactionsQuery = useGetTransactions();
	const accountsQuery = useGetAccounts();
	const categoriesQuery = useGetCategories();
	const settingsQuery = useGetSettings();

	if (transactionsQuery.isPending || accountsQuery.isPending) {
		return (
			<PageShell>
				<Skeleton className="h-24 w-full rounded-xl" />
				<Skeleton className="h-72 w-full rounded-xl" />
			</PageShell>
		);
	}

	if (transactionsQuery.isError) {
		return (
			<PageShell>
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<TriangleAlert
								className="size-16 text-muted-foreground"
								strokeWidth={1.25}
							/>
							<EmptyTitle>Couldn&apos;t load your transactions</EmptyTitle>
							<EmptyDescription>
								Something went wrong reaching the server. Check your connection
								and try again.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center">
							<Button onClick={() => transactionsQuery.refetch()}>
								Try again
							</Button>
						</EmptyContent>
					</Empty>
				</div>
			</PageShell>
		);
	}

	const transactions = transactionsQuery.data;
	const accounts = accountsQuery.data ?? [];
	const categories = categoriesQuery.data ?? [];

	if (transactions.length === 0) {
		// No account yet → nudge account creation first, since a transaction needs one.
		const noAccounts = accounts.length === 0;
		return (
			<PageShell>
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ArrowLeftRight strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No transactions yet</EmptyTitle>
							<EmptyDescription>
								{noAccounts
									? "Add an account first, then your transactions will show up here."
									: "Once you record money moving in or out, it will appear here."}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center">
							{noAccounts ? <AddAccount /> : <AddTransaction />}
						</EmptyContent>
					</Empty>
				</div>
			</PageShell>
		);
	}

	// Toggle options + default, mirroring the dashboard's server-side logic (ADR-0009).
	const currencyCounts = new Map<string, number>();
	for (const a of accounts) {
		if (a.closedAt) continue;
		currencyCounts.set(a.currency, (currencyCounts.get(a.currency) ?? 0) + 1);
	}
	const defaultCurrency =
		settingsQuery.data?.baseCurrency ?? inferBaseCurrency(currencyCounts);
	const availableCurrencies = orderCurrencies(currencyCounts, defaultCurrency);
	const currency =
		currencyParam && availableCurrencies.includes(currencyParam)
			? currencyParam
			: defaultCurrency;

	const setCurrency = (next: string) =>
		navigate({ search: (prev) => ({ ...prev, currency: next }) });
	const setView = (next: "list" | "table") =>
		navigate({
			search: (prev) => ({ ...prev, view: next === "table" ? "table" : undefined }),
		});

	const view = viewParam === "table" ? "table" : "list";
	const scopedTransactions = transactions.filter((t) => t.currency === currency);

	const cutoff = pastWeekCutoff();
	const weekTransactions = scopedTransactions.filter((t) => t.date >= cutoff);

	const actions = (
		<div className="flex items-center gap-2">
			<CurrencyToggle
				currencies={availableCurrencies}
				value={currency}
				onChange={setCurrency}
			/>
			<AddTransaction />
		</div>
	);

	if (scopedTransactions.length === 0) {
		return (
			<PageShell actions={actions}>
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ArrowLeftRight strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No {currency} transactions yet</EmptyTitle>
							<EmptyDescription>
								Once you record money moving in or out of a {currency} account,
								it will appear here.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center">
							<AddTransaction />
						</EmptyContent>
					</Empty>
				</div>
			</PageShell>
		);
	}

	// Full-history table view.
	if (view === "table") {
		return (
			<PageShell actions={actions}>
				<TransactionsSummary transactions={scopedTransactions} />
				<TransactionsTable
					transactions={scopedTransactions}
					accounts={accounts}
					categories={categories}
					onShowLess={() => setView("list")}
				/>
			</PageShell>
		);
	}

	// Past-week preview list.
	return (
		<PageShell actions={actions}>
			{weekTransactions.length === 0 ? (
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ArrowLeftRight strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>Nothing in the past week</EmptyTitle>
							<EmptyDescription>
								You have no {currency} transactions from the last 7 days. See
								your full history to review older activity.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center">
							<Button onClick={() => setView("table")}>See more</Button>
						</EmptyContent>
					</Empty>
				</div>
			) : (
				<>
					<TransactionsSummary transactions={weekTransactions} />
					<TransactionsList
						transactions={weekTransactions}
						accounts={accounts}
						categories={categories}
					/>
					{/* Always available: the table is a different view (sortable/searchable),
					    not merely "more rows", so it stays reachable even when everything
					    already fits in the past-week preview. */}
					<div className="flex justify-center">
						<Button
							variant="outline"
							onClick={() => setView("table")}
							className="gap-1.5"
						>
							See more
							<ChevronDown className="size-4" />
						</Button>
					</div>
				</>
			)}
		</PageShell>
	);
}
