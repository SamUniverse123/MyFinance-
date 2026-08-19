import { ArrowLeftRight, ChevronDown, TriangleAlert } from "lucide-react";
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
import { useGetAccounts } from "#/features/accounts/queries";
import { useGetCategories } from "#/features/categories/queries";
import { useGetPayees } from "#/features/payees/queries";
import { AddTransaction } from "#/features/transactions/components/add-transaction";
import { TransactionsList } from "#/features/transactions/components/transactions-list";
import { TransactionsSummary } from "#/features/transactions/components/transactions-summary";
import { TransactionsTable } from "#/features/transactions/components/transactions-table";
import { useGetTransactions } from "#/features/transactions/queries";

/** Start of the rolling 7-day window (today + 6 prior days), as a local `YYYY-MM-DD`. */
function pastWeekCutoff(): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - 6);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The Transactions tab's body (ADR-0011's preview/table split). It owns its own
 * loading / error / empty states so the surrounding tab bar stays reachable while
 * this panel is still resolving. `currency` is resolved by the parent (which also
 * renders the currency toggle in the header); `view` is the URL-driven list/table
 * toggle.
 */
export function TransactionsLedger({
	currency,
	view,
	onViewChange,
}: {
	currency: string;
	view: "list" | "table";
	onViewChange: (next: "list" | "table") => void;
}) {
	const transactionsQuery = useGetTransactions();
	const accountsQuery = useGetAccounts();
	const categoriesQuery = useGetCategories();
	const payeesQuery = useGetPayees();

	if (transactionsQuery.isPending || accountsQuery.isPending) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-24 w-full rounded-xl" />
				<Skeleton className="h-72 w-full rounded-xl" />
			</div>
		);
	}

	if (transactionsQuery.isError) {
		return (
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
		);
	}

	const transactions = transactionsQuery.data;
	const accounts = accountsQuery.data ?? [];
	const categories = categoriesQuery.data ?? [];
	const payees = payeesQuery.data ?? [];

	if (transactions.length === 0) {
		const noAccounts = accounts.length === 0;
		return (
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
		);
	}

	const scopedTransactions = transactions.filter(
		(t) => t.currency === currency,
	);

	if (scopedTransactions.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center py-10">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ArrowLeftRight strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No {currency} transactions yet</EmptyTitle>
						<EmptyDescription>
							Once you record money moving in or out of a {currency} account, it
							will appear here.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent className="flex-row justify-center">
						<AddTransaction />
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	// Full-history table view.
	if (view === "table") {
		return (
			<div className="flex flex-col gap-4">
				<TransactionsSummary transactions={scopedTransactions} />
				<TransactionsTable
					transactions={scopedTransactions}
					accounts={accounts}
					categories={categories}
					payees={payees}
					onShowLess={() => onViewChange("list")}
				/>
			</div>
		);
	}

	// Past-week preview list.
	const cutoff = pastWeekCutoff();
	const weekTransactions = scopedTransactions.filter((t) => t.date >= cutoff);

	if (weekTransactions.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center py-10">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ArrowLeftRight strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>Nothing in the past week</EmptyTitle>
						<EmptyDescription>
							You have no {currency} transactions from the last 7 days. See your
							full history to review older activity.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent className="flex-row justify-center">
						<Button onClick={() => onViewChange("table")}>See more</Button>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<TransactionsSummary  transactions={weekTransactions} />
			<div className="my-1"></div>
			<TransactionsList
				transactions={weekTransactions}
				accounts={accounts}
				categories={categories}
				payees={payees}
			/>
			{/* Always available: the table is a different view (sortable/searchable),
			    not merely "more rows", so it stays reachable even when everything
			    already fits in the past-week preview. */}
			<div className="flex justify-center">
				<Button
					variant="outline"
					onClick={() => onViewChange("table")}
					className="gap-1.5"
				>
					See more
					<ChevronDown className="size-4" />
				</Button>
			</div>
		</div>
	);
}
