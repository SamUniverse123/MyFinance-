import * as React from "react";
import { formatMoney } from "#/lib/currency";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import type { Transaction } from "@/features/transactions/api";
import { cn } from "@/lib/utils.ts";

// Keyed by weekday index so duplicate letters (S/S, T/T) still get stable unique keys.
const WEEKDAY_LABELS = [
	{ key: "sun", label: "S" },
	{ key: "mon", label: "M" },
	{ key: "tue", label: "T" },
	{ key: "wed", label: "W" },
	{ key: "thu", label: "T" },
	{ key: "fri", label: "F" },
	{ key: "sat", label: "S" },
];

/** Parse a `YYYY-MM-DD` string as a local date (avoids the UTC-midnight day shift). */
function parseLocalDate(date: string): Date {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Current-month spending calendar (Origin's "Spent in March"): a month grid where each
 * day shows that day's total spend, heat-shaded by magnitude. Base-currency expenses
 * only, computed client-side from the transactions list — no extra backend call.
 */
export function MonthlySpendingCalendar({
	transactions,
	currency,
}: {
	transactions: Transaction[];
	currency: string;
}) {
	const {
		spendByDay,
		total,
		daysInMonth,
		firstWeekday,
		maxDay,
		monthLabel,
		today,
	} = React.useMemo(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth(); // 0-indexed
		const days = new Date(year, month + 1, 0).getDate();
		const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun

		const byDay = new Map<number, number>();
		let sum = 0;
		for (const t of transactions) {
			if (t.currency !== currency || t.amount >= 0) continue;
			const d = parseLocalDate(t.date);
			if (d.getFullYear() !== year || d.getMonth() !== month) continue;
			const spend = -t.amount;
			byDay.set(d.getDate(), (byDay.get(d.getDate()) ?? 0) + spend);
			sum += spend;
		}
		const maxDay = Math.max(1, ...byDay.values());

		return {
			spendByDay: byDay,
			total: sum,
			daysInMonth: days,
			firstWeekday,
			maxDay,
			monthLabel: now.toLocaleDateString(undefined, {
				month: "long",
				year: "numeric",
			}),
			today: now.getDate(),
		};
	}, [transactions, currency]);

	// Stable keys: leading blanks are "pad-N", real days are "day-N".
	const cells: { key: string; day: number | null }[] = [
		...Array.from({ length: firstWeekday }, (_, i) => ({
			key: `pad-${i}`,
			day: null,
		})),
		...Array.from({ length: daysInMonth }, (_, i) => ({
			key: `day-${i + 1}`,
			day: i + 1,
		})),
	];

	return (
		<Card className="flex h-full flex-col gap-0 py-0 ">
			<CardHeader className="px-5 py-4">
				<CardTitle>Spent in {monthLabel.split(" ")[0]}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4 px-5 pb-5">
				<div className="text-3xl font-semibold tracking-tight tabular-nums">
					{formatMoney(total, currency)}
				</div>

				<div>
					<div className="mb-1 grid grid-cols-7 gap-1">
						{WEEKDAY_LABELS.map((d) => (
							<div
								key={d.key}
								className="text-center text-[0.65rem] font-medium text-muted-foreground"
							>
								{d.label}
							</div>
						))}
					</div>
					<div className="grid grid-cols-7 gap-1">
						{cells.map((cell) => {
							if (cell.day === null) return <div key={cell.key} />;
							const day = cell.day;
							const spend = spendByDay.get(day) ?? 0;
							const intensity = spend > 0 ? 0.12 + (spend / maxDay) * 0.5 : 0;
							const isToday = day === today;
							return (
								<div
									key={day}
									className={cn(
										"flex aspect-square flex-col items-center justify-center rounded-md border text-center",
										isToday ? "border-primary" : "border-transparent",
										spend === 0 && "bg-muted/70",
									)}
									style={
										spend > 0
											? {
													backgroundColor: `color-mix(in oklch, var(--color-emerald-500) ${intensity * 100}%, transparent)`,
												}
											: undefined
									}
									title={spend > 0 ? formatMoney(spend, currency) : undefined}
								>
									<span className="text-[0.65rem] leading-none text-muted-foreground">
										{day}
									</span>
									{spend > 0 && (
										<span className="mt-0.5 text-[0.8rem] leading-none font-medium tabular-nums">
											{formatMoney(spend, currency).replace(/\.\d+$/, "")}
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
