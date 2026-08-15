import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Pencil, TriangleAlert } from "lucide-react";
import { PageBreadcrumb } from "#/components/page-breadcrumb";
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
	accountsListOptions,
	useGetAccounts,
} from "#/features/accounts/queries";
import type { Transaction } from "#/features/transactions/api";
import { DeleteTransaction } from "#/features/transactions/components/delete-transaction";
import { EditTransaction } from "#/features/transactions/components/edit-transaction";
import {
	transactionDetailOptions,
	useGetTransaction,
} from "#/features/transactions/queries";
import { formatMoney } from "#/lib/currency";
import { cn } from "#/lib/utils";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_app/transactions/$transactionId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				transactionDetailOptions(params.transactionId),
			),
			context.queryClient.ensureQueryData(accountsListOptions()),
		]),
	component: TransactionDetailPage,
});

function PageShell({
	children,
	transactionName,
}: {
	children: React.ReactNode;
	/** Current transaction's title for the breadcrumb; falls back to "Transaction" before it loads. */
	transactionName?: string;
}) {
	return (
		<>
			<SiteHeader
				breadcrumb={
					<PageBreadcrumb
						items={[
							{ label: "Transactions", to: "/transactions" },
							{ label: transactionName ?? "Transaction" },
						]}
					/>
				}
				actions={
					<Button variant="ghost" size="sm" asChild>
						<Link to="/transactions">
							<ChevronLeft />
							All transactions
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

function fmtDay(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		weekday: "long",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function fmtTimestamp(value: Transaction["createdAt"]): string {
	return new Date(value as unknown as string).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
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

function TransactionDetail({
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
		<div className="flex flex-col gap-6">
			<section className="rounded-xl border bg-card p-5 md:p-6">
				<div className="flex items-start gap-4">
					<span
						className="flex size-14 shrink-0 items-center justify-center rounded-xl"
						style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
					>
						<Icon className="size-7" />
					</span>
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-2xl font-semibold">{title}</h2>
						<p className="truncate text-sm text-muted-foreground">
							{account?.name ?? "Unknown account"} · {fmtDay(transaction.date)}
						</p>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<EditTransaction transaction={transaction}>
							<Button variant="outline" size="sm">
								<Pencil />
								Edit
							</Button>
						</EditTransaction>
						<DeleteTransaction transaction={transaction} />
					</div>
				</div>

				<Separator className="my-5" />

				<div className="flex items-baseline gap-2">
					<span
						className={cn(
							"text-3xl font-semibold tabular-nums",
							income && "text-emerald-600 dark:text-emerald-500",
						)}
					>
						{income ? "+" : ""}
						{formatMoney(transaction.amount, transaction.currency)}
					</span>
					<span className="text-sm text-muted-foreground">
						{transaction.currency}
					</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					{income ? "Money in" : "Money out"}
				</p>
			</section>

			<section className="rounded-xl border bg-card p-5 md:p-6">
				<h3 className="mb-4 text-sm font-medium">Details</h3>
				<dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
					<DetailItem
						label="Account"
						value={account?.name ?? "Unknown account"}
					/>
					<DetailItem label="Date" value={fmtDay(transaction.date)} />
					<DetailItem
						label="Status"
						value={<span className="capitalize">{transaction.status}</span>}
					/>
					<DetailItem label="Currency" value={transaction.currency} />
					{transaction.payeeName && (
						<DetailItem label="Payee" value={transaction.payeeName} />
					)}
					<DetailItem
						label="Created"
						value={fmtTimestamp(transaction.createdAt)}
					/>
					<DetailItem
						label="Updated"
						value={fmtTimestamp(transaction.updatedAt)}
					/>
				</dl>
				{transaction.note && (
					<>
						<Separator className="my-5" />
						<div className="flex flex-col gap-0.5">
							<dt className="text-xs text-muted-foreground">Note</dt>
							<dd className="text-sm whitespace-pre-wrap">
								{transaction.note}
							</dd>
						</div>
					</>
				)}
			</section>
		</div>
	);
}

function TransactionDetailPage() {
	const { transactionId } = Route.useParams();
	const {
		data: transaction,
		isPending,
		isError,
		error,
		refetch,
	} = useGetTransaction(transactionId);
	const { data: accounts } = useGetAccounts();

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
								{notFound
									? "Transaction not found"
									: "Couldn't load this transaction"}
							</EmptyTitle>
							<EmptyDescription>
								{notFound
									? "This transaction doesn't exist or you don't have access to it."
									: "Something went wrong reaching the server. Try again."}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center gap-2">
							{notFound ? (
								<Button asChild>
									<Link to="/transactions">Back to transactions</Link>
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

	const account = (accounts ?? []).find((a) => a.id === transaction.accountId);
	const transactionName =
		transaction.payeeName || transaction.note || "Transaction";

	return (
		<PageShell transactionName={transactionName}>
			<TransactionDetail transaction={transaction} account={account} />
		</PageShell>
	);
}
