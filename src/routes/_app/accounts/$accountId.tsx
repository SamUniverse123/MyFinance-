import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Pencil, TriangleAlert } from "lucide-react";
import { prefetch } from "@/features/shared/http";
import { PageBreadcrumb } from "#/components/page-breadcrumb";
import { PageControls } from "#/components/page-controls";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { getAccountTypeMeta } from "#/features/accounts/account-types";
import type { Account } from "#/features/accounts/api";
import {
	accountBalance,
	txnTotalsByAccount,
} from "#/features/accounts/balances";
import { DeleteAccount } from "#/features/accounts/components/delete-account";
import { EditAccount } from "#/features/accounts/components/edit-account";
import {
	accountsDetailsOptions,
	useGetAccount,
} from "#/features/accounts/queries";
import type { Payee } from "#/features/payees/api";
import { PayeeAvatar } from "#/features/payees/components/payee-avatar";
import { payeesListOptions, useGetPayees } from "#/features/payees/queries";
import {
	payeesById as buildPayeesById,
	payeeIdentity,
} from "#/features/payees/resolve";
import type { Transaction } from "#/features/transactions/api";
import {
	transactionsListOptions,
	useGetTransactions,
} from "#/features/transactions/queries";
import { usePagination } from "#/hooks/use-pagination";
import { currencyFlag, formatMoney } from "#/lib/currency";
import { cn } from "#/lib/utils";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_app/accounts/$accountId")({
	loader: ({ context, params }) =>
		prefetch(
			context.queryClient.ensureQueryData(
				accountsDetailsOptions(params.accountId),
			),
			context.queryClient.ensureQueryData(transactionsListOptions()),
			context.queryClient.ensureQueryData(payeesListOptions()),
		),
	component: AccountDetailPage,
});

/** Country flag for a currency, sized to sit inline with its code. Falls back to a
 *  neutral chip for supranational codes and metals that have no national flag. */
function CurrencyFlag({ code }: { code: string }) {
	const flag = currencyFlag(code);
	if (!flag) {
		return (
			<span
				aria-hidden
				className="inline-block h-[1em] w-[1.333em] shrink-0 rounded-[2px] bg-muted"
			/>
		);
	}
	return (
		<span
			aria-hidden
			className={cn(
				"fi shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.06)]",
				`fi-${flag}`,
			)}
		/>
	);
}

function PageShell({
	children,
	accountName,
}: {
	children: React.ReactNode;
	/** Current account's name for the breadcrumb; falls back to "Account" before it loads. */
	accountName?: string;
}) {
	return (
		<>
			<SiteHeader
				breadcrumb={
					<PageBreadcrumb
						items={[
							{ label: "Accounts", to: "/accounts" },
							{ label: accountName ?? "Account" },
						]}
					/>
				}
				actions={
					<Button variant="ghost" size="sm" asChild>
						<Link to="/accounts">
							<ChevronLeft />
							All accounts
						</Link>
					</Button>
				}
			/>
			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col">
					<div className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
						{children}
					</div>
				</div>
			</div>
		</>
	);
}

function fmtDate(value: Account["createdAt"]): string {
	return new Date(value as unknown as string).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/** A transaction's `date` is a plain `YYYY-MM-DD` string; render it without going
 *  through `new Date()` (which would reinterpret it in the local timezone). */
function fmtTxnDate(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	if (!y || !m || !d) return date;
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function DetailItem({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium">{value}</dd>
		</div>
	);
}

function AccountDetail({ account }: { account: Account }) {
	const meta = getAccountTypeMeta(account.type);
	const Icon = meta.icon;
	const closed = Boolean(account.closedAt);

	// This account's transactions (newest first) and the resulting current balance:
	// opening balance plus every transaction posted to the account. The net-worth
	// contribution is that same balance, unless the account is excluded.
	const { data: transactions } = useGetTransactions();
	const { data: payees } = useGetPayees();
	const rows = (transactions ?? [])
		.filter((t) => t.accountId === account.id)
		.sort(
			(a, b) =>
				b.date.localeCompare(a.date) ||
				String(b.createdAt).localeCompare(String(a.createdAt)),
		);
	const currentBalance = accountBalance(
		account,
		txnTotalsByAccount(transactions ?? []),
	);

	const subtitle = [
		meta.label,
		account.institution || null,
		account.mask ? `•••• ${account.mask}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="flex flex-col gap-6">
			{/* Identity + balance */}
			<section className="rounded-xl border bg-card p-5 md:p-6">
				<div className="flex items-start gap-4">
					<span
						className="flex size-14 shrink-0 items-center justify-center rounded-xl"
						style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
					>
						<Icon className="size-7" />
					</span>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h2 className="truncate text-2xl font-semibold">
								{account.name}
							</h2>
							{closed && (
								<span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
									Closed
								</span>
							)}
						</div>
						<p className="truncate text-sm text-muted-foreground">{subtitle}</p>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<EditAccount account={account}>
							<Button variant="outline" size="sm">
								<Pencil />
								Edit
							</Button>
						</EditAccount>
						<DeleteAccount account={account} />
					</div>
				</div>

				<Separator className="my-5" />

				<div className="flex items-baseline gap-2">
					<span className="text-3xl font-semibold tabular-nums">
						{formatMoney(currentBalance, account.currency)}
					</span>
					<span className="text-sm text-muted-foreground">
						{account.currency}
					</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					Current balance
					<span className="mx-1.5">·</span>
					Opening {formatMoney(account.initialBalance, account.currency)}
				</p>
			</section>

			{/* Details */}
			<section className="rounded-xl border bg-card p-5 md:p-6">
				<h3 className="mb-4 text-sm font-medium">Details</h3>
				<dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
					<DetailItem label="Type" value={meta.label} />
					<DetailItem
						label="Currency"
						value={
							<span className="flex items-center gap-1.5">
								<CurrencyFlag code={account.currency} />
								{account.currency}
							</span>
						}
					/>

					<DetailItem
						label="Status"
						value={
							closed
								? `Closed ${fmtDate(account.closedAt as Account["createdAt"])}`
								: "Active"
						}
					/>
					<DetailItem
						label="Net worth"
						value={
							account.excludeFromNetWorth
								? "Excluded"
								: formatMoney(currentBalance, account.currency)
						}
					/>
					{account.creditLimit != null && (
						<DetailItem
							label="Credit limit"
							value={formatMoney(account.creditLimit, account.currency)}
						/>
					)}
					{account.institution && (
						<DetailItem label="Institution" value={account.institution} />
					)}
					{account.mask && (
						<DetailItem label="Last 4" value={`•••• ${account.mask}`} />
					)}
					<DetailItem label="Created" value={fmtDate(account.createdAt)} />
					<DetailItem label="Updated" value={fmtDate(account.updatedAt)} />
				</dl>
			</section>

			<AccountTransactions transactions={rows} payees={payees ?? []} />
		</div>
	);
}

function TransactionRow({
	transaction,
	payee,
}: {
	transaction: Transaction;
	payee: { name: string; domain: string | null } | null;
}) {
	const income = transaction.amount > 0;
	const title = payee?.name || transaction.note || "Transaction";

	return (
		<Link
			to="/transactions/$transactionId"
			params={{ transactionId: transaction.id }}
			className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
		>
			{payee && (
				<PayeeAvatar name={payee.name} domain={payee.domain} size={32} />
			)}
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">{title}</div>
				<div className="truncate text-xs text-muted-foreground">
					{fmtTxnDate(transaction.date)}
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

/** This account's transactions, newest first (already filtered/sorted by the
 *  parent, which also derives the balance from them). */
const TRANSACTIONS_PAGE_SIZE = 5;

function AccountTransactions({
	transactions,
	payees,
}: {
	transactions: Transaction[];
	payees: Payee[];
}) {
	const payeeMap = buildPayeesById(payees);
	const { page, setPage, totalPages, pageItems } = usePagination(
		transactions,
		TRANSACTIONS_PAGE_SIZE,
	);

	return (
		<section className="rounded-xl border bg-card p-5 md:p-6">
			<h3 className="mb-4 text-sm font-medium">Transactions</h3>
			{transactions.length === 0 ? (
				<Empty className="py-8">
					<EmptyHeader>
						<EmptyTitle className="text-base">No transactions yet</EmptyTitle>
						<EmptyDescription>
							Transactions for this account will appear here once you add them.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					<div className="-mx-5 divide-y border-t md:-mx-6">
						{pageItems.map((transaction) => (
							<TransactionRow
								key={transaction.id}
								transaction={transaction}
								payee={payeeIdentity(transaction, payeeMap)}
							/>
						))}
					</div>
					<div className="mt-4">
						<PageControls
							page={page}
							totalPages={totalPages}
							onPageChange={setPage}
						/>
					</div>
				</>
			)}
		</section>
	);
}

function AccountDetailPage() {
	const { accountId } = Route.useParams();
	const {
		data: account,
		isPending,
		isError,
		error,
		refetch,
	} = useGetAccount(accountId);

	if (isPending) {
		return (
			<PageShell>
				<div className="flex flex-col gap-6">
					<Skeleton className="h-40 w-full rounded-xl" />
					<Skeleton className="h-48 w-full rounded-xl" />
				</div>
			</PageShell>
		);
	}

	if (isError) {
		const notFound =
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			error.status === 404;
		return (
			<PageShell>
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<TriangleAlert
								className="size-16 text-muted-foreground"
								strokeWidth={1.25}
							/>
							<EmptyTitle>
								{notFound ? "Account not found" : "Couldn't load this account"}
							</EmptyTitle>
							<EmptyDescription>
								{notFound
									? "This account doesn't exist or you don't have access to it."
									: "Something went wrong reaching the server. Try again."}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center gap-2">
							{notFound ? (
								<Button asChild>
									<Link to="/accounts">Back to accounts</Link>
								</Button>
							) : (
								<Button onClick={() => refetch()}>Try again</Button>
							)}
						</EmptyContent>
					</Empty>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell accountName={account.name}>
			<AccountDetail account={account} />
		</PageShell>
	);
}
