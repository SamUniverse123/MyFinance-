import { ArrowRightLeft } from "lucide-react";
import { AnimatedMoney } from "@/components/animated-money";
import type { Transaction } from "@/features/transactions/api";

/** Money in / out and count per currency (we can't FX-convert across currencies). */
function summarize(
	transactions: Transaction[],
): { currency: string; in: number; out: number; count: number }[] {
	const totals = new Map<string, { in: number; out: number; count: number }>();
	for (const t of transactions) {
		const bucket = totals.get(t.currency) ?? { in: 0, out: 0, count: 0 };
		if (t.amount >= 0) bucket.in += t.amount;
		else bucket.out += -t.amount;
		bucket.count += 1;
		totals.set(t.currency, bucket);
	}
	return [...totals.entries()].map(([currency, v]) => ({ currency, ...v }));
}

/**
 * Money-in/out summary reused across the transactions list and table. Reflects whatever
 * scope it's handed — the past week on the preview list, the full history in the table
 * (ADR-0011). Includes a transaction count; no date-range stat (the scope is always
 * either "past week" or "all history").
 */
export function TransactionsSummary({
	transactions,
}: {
	transactions: Transaction[];
}) {
	const summary = summarize(transactions);

	return (
		<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ">
			{summary.map(({ currency, in: moneyIn, out: moneyOut, count }) => (
				<div key={currency} className="rounded-xl border bg-card px-4 py-4 bg-olive-50 inset-shadow-xs">
					<div className="flex items-center justify-between">
						<div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							{currency}
						</div>
						<div className="text-xs text-muted-foreground tabular-nums">
							{count} {count === 1 ? "transaction" : "transactions"}
						</div>
					</div>
					<div className="mt-3 flex items-end justify-between gap-4 ">
						<div>
							<div className="text-xs text-muted-foreground">Money in</div>
							<AnimatedMoney
								amount={moneyIn}
								currency={currency}
								forceSign="+"
								className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-500"
							/>
						</div>
						<ArrowRightLeft
							size={30}
							className="text-stone-300"
							strokeWidth={1.25}
						/>
						<div className="text-right">
							<div className="text-xs text-muted-foreground">Money out</div>
							<AnimatedMoney
								amount={moneyOut}
								currency={currency}
								forceSign="-"
								className="font-semibold tabular-nums"
							/>
						</div>
					</div>
				</div>
			))}
		</section>
	);
}
