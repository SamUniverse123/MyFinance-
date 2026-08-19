import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { prefetch } from "@/features/shared/http";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import {
	accountsListOptions,
	useGetAccounts,
} from "#/features/accounts/queries";
import { categoriesListOptions } from "#/features/categories/queries";
import { AddPayee } from "#/features/payees/components/add-payee";
import { payeesListOptions } from "#/features/payees/queries";
import { AddTransaction } from "#/features/transactions/components/add-transaction";
import { PayeesPanel } from "#/features/transactions/components/payees-panel";
import { RecurringPanel } from "#/features/transactions/components/recurring-panel";
import { TransactionsLedger } from "#/features/transactions/components/transactions-ledger";
import { transactionsListOptions } from "#/features/transactions/queries";
import { inferBaseCurrency, orderCurrencies } from "#/lib/currency";
import { CurrencyToggle } from "@/components/currency-toggle";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SiteHeader } from "@/components/site-header";
import { useGetSettings } from "@/features/settings/queries";

const TABS = ["transactions", "payees", "recurring"] as const;
type TransactionsTab = (typeof TABS)[number];

const transactionsSearchSchema = z.object({
	// No default — an absent/unrecognized currency falls back to the same
	// baseCurrency-or-most-common-account rule the dashboard uses.
	currency: z.string().optional().catch(undefined),
	// list = past-week preview (default); table = full-history table (ADR-0011).
	view: z.enum(["list", "table"]).optional().catch(undefined),
	// Which sub-view is active (ADR-0013). Absent = transactions.
	tab: z.enum(TABS).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/transactions/")({
	validateSearch: transactionsSearchSchema,
	// The panels need account + category + payee data to render; prefetch all.
	loader: ({ context }) =>
		prefetch(
			context.queryClient.ensureQueryData(transactionsListOptions()),
			context.queryClient.ensureQueryData(accountsListOptions()),
			context.queryClient.ensureQueryData(categoriesListOptions()),
			context.queryClient.ensureQueryData(payeesListOptions()),
		),
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
	const {
		currency: currencyParam,
		view: viewParam,
		tab: tabParam,
	} = Route.useSearch();
	const navigate = Route.useNavigate();
	const accountsQuery = useGetAccounts();
	const settingsQuery = useGetSettings();

	const activeTab: TransactionsTab = tabParam ?? "transactions";
	const view = viewParam === "table" ? "table" : "list";

	// Currency toggle options + default, mirroring the dashboard's logic (ADR-0009).
	const accounts = accountsQuery.data ?? [];
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
			search: (prev) => ({
				...prev,
				view: next === "table" ? "table" : undefined,
			}),
		});
	const setTab = (next: string) =>
		navigate({
			search: (prev) => ({
				...prev,
				tab: next === "transactions" ? undefined : (next as TransactionsTab),
			}),
		});

	// Header actions swap with the active tab (Q9). The "add" buttons are hidden on
	// mobile — the create FAB owns creation there (Q5) — but the currency toggle stays.
	const actions =
		activeTab === "transactions" ? (
			<div className="flex items-center gap-2">
				<CurrencyToggle
					currencies={availableCurrencies}
					value={currency}
					onChange={setCurrency}
				/>
				<div className="hidden md:flex">
					<AddTransaction />
				</div>
			</div>
		) : activeTab === "payees" ? (
			<div className="hidden md:flex">
				<AddPayee />
			</div>
		) : undefined;

	return (
		<PageShell actions={actions}>
			<Tabs value={activeTab} onValueChange={setTab}>
				<TabsList variant="line" className="mx-5 mb-6 gap-x-5">
					<TabsTrigger value="transactions">Transactions</TabsTrigger>
					<TabsTrigger value="payees">Payees</TabsTrigger>
					<TabsTrigger value="recurring">Recurring</TabsTrigger>
				</TabsList>
					<TabsContent value="transactions" className="mx-8 my-5">
						<TransactionsLedger
							currency={currency}
							view={view}
							onViewChange={setView}
						/>
					</TabsContent>
					<TabsContent value="payees">
						<PayeesPanel />
					</TabsContent>
					<TabsContent value="recurring">
						<RecurringPanel />
					</TabsContent>
			</Tabs>
		</PageShell>
	);
}
