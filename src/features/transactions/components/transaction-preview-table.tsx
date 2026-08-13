import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "#/lib/currency";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { getAccountTypeMeta } from "@/features/accounts/account-types";
import type { Account } from "@/features/accounts/api";
import type { Transaction } from "@/features/transactions/api";
import { cn } from "@/lib/utils.ts";

const PREVIEW_LIMIT = 10;

function PreviewRow({
	transaction,
	account,
}: {
	transaction: Transaction;
	account: Account | undefined;
}) {
	const meta = getAccountTypeMeta(account?.type ?? "other");
	const Icon = meta.icon;
	const income = transaction.amount > 0;
	const title = transaction.payeeName || transaction.note || "Transaction";

	return (
		<Link
			to="/transactions/$transactionId"
			params={{ transactionId: transaction.id }}
			className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
		>
			<span
				className="flex size-8 shrink-0 items-center justify-center rounded-lg"
				style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
			>
				<Icon className="size-4" />
			</span>

			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">{title}</div>
				<div className="truncate text-xs text-muted-foreground">
					{account?.name ?? "Unknown account"}
				</div>
			</div>

			<div
				className={cn(
					"shrink-0 text-sm font-medium tabular-nums",
					income && "text-emerald-600 dark:text-emerald-500",
				)}
			>
				{income ? "+" : ""}
				{formatMoney(transaction.amount, transaction.currency)}
			</div>

			<ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
		</Link>
	);
}

/**
 * Lightweight, read-only recent-transactions preview — the dashboard's answer to
 * `docs/design/dashboard-and-accounts-pages.md §6.1`: not the full filterable
 * `transactions-list.tsx`, just the latest `PREVIEW_LIMIT` rows with a "View all"
 * link. No URL filter state, no day grouping, no in/out summary.
 */
export function TransactionPreviewTable({
	transactions,
	accounts,
}: {
	transactions: Transaction[];
	accounts: Account[];
}) {
	const accountsById = new Map(accounts.map((a) => [a.id, a]));
	const recent = [...transactions]
		.sort(
			(a, b) =>
				b.date.localeCompare(a.date) ||
				String(b.createdAt).localeCompare(String(a.createdAt)),
		)
		.slice(0, PREVIEW_LIMIT);

	return (
		<Card className="gap-0 py-0">
			<CardHeader className="px-4 py-3">
				<CardTitle>Recent transactions</CardTitle>
				<CardAction>
					<Button variant="ghost" size="sm" asChild>
						<Link to="/transactions">View all</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="p-0">
				{recent.length === 0 ? (
					<p className="px-4 py-6 text-center text-sm text-muted-foreground">
						No transactions yet.
					</p>
				) : (
					<div className="divide-y">
						{recent.map((transaction) => (
							<PreviewRow
								key={transaction.id}
								transaction={transaction}
								account={accountsById.get(transaction.accountId)}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
