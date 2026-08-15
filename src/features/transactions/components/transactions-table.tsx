import { useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronsUpDown,
	Search,
	SlidersHorizontal,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table.tsx";
import { getAccountTypeMeta } from "@/features/accounts/account-types";
import type { Account } from "@/features/accounts/api";
import type { Category } from "@/features/categories/api";
import { CategoryBadge } from "@/features/categories/components/category-badge";
import type { Transaction } from "@/features/transactions/api";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils.ts";

type ColumnKey = "merchant" | "category" | "account" | "date" | "amount";
type SortKey = "category" | "date" | "amount";
type SortDir = "asc" | "desc";

const COLUMNS: { key: ColumnKey; label: string; sort?: SortKey }[] = [
	{ key: "merchant", label: "Merchant / Description" },
	{ key: "category", label: "Category", sort: "category" },
	{ key: "account", label: "Account" },
	{ key: "date", label: "Date", sort: "date" },
	{ key: "amount", label: "Amount", sort: "amount" },
];

const STORAGE_KEY = "transactions-table-columns";
const DEFAULT_VISIBILITY: Record<ColumnKey, boolean> = {
	merchant: true,
	category: true,
	account: true,
	date: true,
	amount: true,
};

/** Persist which columns are shown, same pattern as the accounts list/grid preference. */
function useColumnVisibility(): [
	Record<ColumnKey, boolean>,
	(key: ColumnKey, visible: boolean) => void,
] {
	const [visibility, setVisibility] =
		React.useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBILITY);

	React.useEffect(() => {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) return;
		try {
			const parsed = JSON.parse(stored) as Partial<Record<ColumnKey, boolean>>;
			setVisibility((prev) => ({ ...prev, ...parsed }));
		} catch {
			// ignore malformed storage
		}
	}, []);

	const toggle = React.useCallback((key: ColumnKey, visible: boolean) => {
		setVisibility((prev) => {
			const next = { ...prev, [key]: visible };
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			return next;
		});
	}, []);

	return [visibility, toggle];
}

function parseLocalDate(date: string): Date {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function formatDate(date: string): string {
	return parseLocalDate(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function SortHeader({
	label,
	active,
	dir,
	onClick,
	align = "left",
}: {
	label: string;
	active: boolean;
	dir: SortDir;
	onClick: () => void;
	align?: "left" | "right";
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center gap-1 font-medium text-foreground transition-colors hover:text-foreground/70",
				align === "right" && "ml-auto flex-row-reverse",
			)}
		>
			{label}
			{active ? (
				dir === "asc" ? (
					<ArrowUp className="size-3.5" />
				) : (
					<ArrowDown className="size-3.5" />
				)
			) : (
				<ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
			)}
		</button>
	);
}

/**
 * Full-history transactions table (ADR-0011): read-only, sortable on Category/Date/
 * Amount, with client-side search (payee/note) and persisted column visibility. Rows
 * open the transaction detail page. Filtering is intentionally not here yet.
 */
export function TransactionsTable({
	transactions,
	accounts,
	categories,
	onShowLess,
}: {
	transactions: Transaction[];
	accounts: Account[];
	categories: Category[];
	onShowLess: () => void;
}) {
	const navigate = useNavigate();
	const [visibility, toggleColumn] = useColumnVisibility();
	const [search, setSearch] = React.useState("");
	const [sortKey, setSortKey] = React.useState<SortKey>("date");
	const [sortDir, setSortDir] = React.useState<SortDir>("desc");

	const accountsById = React.useMemo(
		() => new Map(accounts.map((a) => [a.id, a])),
		[accounts],
	);
	const categoriesById = React.useMemo(
		() => new Map(categories.map((c) => [c.id, c])),
		[categories],
	);

	const onSort = (key: SortKey) => {
		if (key === sortKey) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
		}
	};

	const rows = React.useMemo(() => {
		const q = search.trim().toLowerCase();
		const filtered = q
			? transactions.filter((t) =>
					`${t.payeeName ?? ""} ${t.note ?? ""}`.toLowerCase().includes(q),
				)
			: transactions;

		const sorted = [...filtered].sort((a, b) => {
			let cmp = 0;
			if (sortKey === "date") {
				cmp =
					a.date.localeCompare(b.date) ||
					String(a.createdAt).localeCompare(String(b.createdAt));
			} else if (sortKey === "amount") {
				cmp = a.amount - b.amount;
			} else {
				// category: by name, uncategorized last
				const an = a.categoryId
					? (categoriesById.get(a.categoryId)?.name ?? "")
					: "";
				const bn = b.categoryId
					? (categoriesById.get(b.categoryId)?.name ?? "")
					: "";
				if (!an && bn) cmp = 1;
				else if (an && !bn) cmp = -1;
				else cmp = an.localeCompare(bn);
			}
			return sortDir === "asc" ? cmp : -cmp;
		});
		return sorted;
	}, [transactions, search, sortKey, sortDir, categoriesById]);

	const visibleColumns = COLUMNS.filter((c) => visibility[c.key]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Button variant="outline" size="sm" onClick={onShowLess}>
					<ChevronLeft className="size-4" />
					Show less
				</Button>

				<div className="flex items-center gap-2">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search"
							className="h-9 w-40 pl-8 sm:w-56"
						/>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<SlidersHorizontal className="size-4" />
								Columns
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Columns</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{COLUMNS.map((col) => {
								const visibleCount = COLUMNS.filter(
									(c) => visibility[c.key],
								).length;
								const isLastVisible = visibility[col.key] && visibleCount === 1;
								return (
									<DropdownMenuCheckboxItem
										key={col.key}
										checked={visibility[col.key]}
										// Keep at least one column visible.
										disabled={isLastVisible}
										onCheckedChange={(checked) =>
											toggleColumn(col.key, checked)
										}
										onSelect={(e) => e.preventDefault()}
									>
										{col.label}
									</DropdownMenuCheckboxItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							{visibleColumns.map((col) => (
								<TableHead
									key={col.key}
									className={cn(col.key === "amount" && "text-right")}
								>
									{col.sort ? (
										<SortHeader
											label={col.label}
											active={sortKey === col.sort}
											dir={sortDir}
											align={col.key === "amount" ? "right" : "left"}
											onClick={() => onSort(col.sort as SortKey)}
										/>
									) : (
										col.label
									)}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={visibleColumns.length}
									className="py-10 text-center text-muted-foreground"
								>
									No transactions match your search.
								</TableCell>
							</TableRow>
						) : (
							rows.map((t) => {
								const account = accountsById.get(t.accountId);
								const category = t.categoryId
									? categoriesById.get(t.categoryId)
									: undefined;
								const income = t.amount > 0;
								const meta = getAccountTypeMeta(account?.type ?? "other");
								const AccountIcon = meta.icon;
								return (
									<TableRow
										key={t.id}
										className="cursor-pointer"
										onClick={() =>
											navigate({
												to: "/transactions/$transactionId",
												params: { transactionId: t.id },
											})
										}
									>
										{visibility.merchant && (
											<TableCell className="font-medium">
												{t.payeeName || t.note || "Transaction"}
											</TableCell>
										)}
										{visibility.category && (
											<TableCell>
												<CategoryBadge category={category} />
											</TableCell>
										)}
										{visibility.account && (
											<TableCell className="text-muted-foreground">
												<span className="flex items-center gap-1.5">
													<span
														className="flex size-4 shrink-0 items-center justify-center rounded"
														style={{
															color: meta.color,
															backgroundColor: `${meta.color}1f`,
														}}
													>
														<AccountIcon className="size-2.5" />
													</span>
													{account?.name ?? "Unknown account"}
												</span>
											</TableCell>
										)}
										{visibility.date && (
											<TableCell className="text-muted-foreground">
												{formatDate(t.date)}
											</TableCell>
										)}
										{visibility.amount && (
											<TableCell
												className={cn(
													"text-right font-medium tabular-nums",
													income && "text-emerald-600 dark:text-emerald-500",
												)}
											>
												{income ? "+" : ""}
												{formatMoney(t.amount, t.currency)}
											</TableCell>
										)}
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
