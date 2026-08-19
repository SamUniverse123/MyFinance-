import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { formatMoney } from "#/lib/currency";
import { getAccountTypeMeta } from "@/features/accounts/account-types";
import type { Account } from "@/features/accounts/api";
import type { Category } from "@/features/categories/api";
import { CategoryBadge } from "@/features/categories/components/category-badge";
import type { Payee } from "@/features/payees/api";
import { PayeeAvatar } from "@/features/payees/components/payee-avatar";
import {
	payeesById as buildPayeesById,
	payeeIdentity,
} from "@/features/payees/resolve";
import type { Transaction } from "@/features/transactions/api";
import { cn } from "@/lib/utils.ts";

/** Parse a `YYYY-MM-DD` string as a local date (avoids the UTC-midnight day shift). */
function parseLocalDate(date: string): Date {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function formatDayHeading(date: string): string {
	const d = parseLocalDate(date);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	return d.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/** Group into date sections, newest day first, newest-created first within a day. */
function groupByDay(
	transactions: Transaction[],
): { date: string; items: Transaction[] }[] {
	const groups = new Map<string, Transaction[]>();
	for (const t of transactions) {
		const list = groups.get(t.date) ?? [];
		list.push(t);
		groups.set(t.date, list);
	}
	return [...groups.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([date, items]) => ({
			date,
			items: items.sort((a, b) =>
				String(b.createdAt).localeCompare(String(a.createdAt)),
			),
		}));
}

function TransactionRow({
	transaction,
	account,
	category,
	payee,
}: {
	transaction: Transaction;
	account: Account | undefined;
	category: Category | undefined;
	payee: { name: string; domain: string | null } | null;
}) {
	const meta = getAccountTypeMeta(account?.type ?? "other");
	const Icon = meta.icon;
	const income = transaction.amount > 0;

	const title = payee?.name || transaction.note || "Transaction";

	return (
		<Link
			to="/transactions/$transactionId"
			params={{ transactionId: transaction.id }}
			className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none "
		>
			{payee ? (
				// Payee brand logo (ADR-0014), falling back to initials.
				<PayeeAvatar
					name={payee.name}
					domain={payee.domain}
					size={40}
					className="rounded-lg"
				/>
			) : (
				<span
					className="flex size-10 shrink-0 items-center justify-center rounded-lg"
					style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
				>
					<Icon className="size-5" />
				</span>
			)}

			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{title}</div>
				<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					<CategoryBadge category={category} />
					<span className="truncate capitalize ">
						· {account?.name ?? "Unknown account"} · {transaction.status}
					</span>
				</div>
			</div>

			<div className="shrink-0 text-right">
				<div
					className={cn(
						"font-medium tabular-nums",
						income && "text-emerald-600 dark:text-emerald-500",
					)}
				>
					{income ? "+" : ""}
					{formatMoney(transaction.amount, transaction.currency)}
				</div>
				<div className="text-xs text-muted-foreground">
					{transaction.currency}
				</div>
			</div>

			<ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
		</Link>
	);
}

/**
 * Day-grouped transaction rows — the "recent activity" preview (ADR-0011). The
 * money-in/out summary now lives in a shared `TransactionsSummary` above this, so both
 * the list and the table can reuse it.
 */
export function TransactionsList({
	transactions,
	accounts,
	categories,
	payees,
}: {
	transactions: Transaction[];
	accounts: Account[];
	categories: Category[];
	payees: Payee[];
}) {
	const accountsById = new Map(accounts.map((a) => [a.id, a]));
	const categoriesById = new Map(categories.map((c) => [c.id, c]));
	const payeeMap = buildPayeesById(payees);
	const groups = groupByDay(transactions);

	return (
		<div className="flex flex-col gap-5">
			{groups.map((group) => (
				<section key={group.date}>
					<h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
						{formatDayHeading(group.date)}
					</h2>
					<div className="divide-y overflow-hidden rounded-xl border bg-card">
						{group.items.map((transaction) => (
							<TransactionRow
								key={transaction.id}
								transaction={transaction}
								account={accountsById.get(transaction.accountId)}
								category={
									transaction.categoryId
										? categoriesById.get(transaction.categoryId)
										: undefined
								}
								payee={payeeIdentity(transaction, payeeMap)}
							/>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
