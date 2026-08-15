import { Link } from "@tanstack/react-router";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart } from "@/components/charts";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { cn } from "@/lib/utils.ts";

/** DashboardRange from the API includes `undefined` (optional query param); the toggle only uses the concrete values. */
type Range = "7d" | "30d" | "90d";

const HERO_STROKE = "oklch(0.62 0.19 255)"; // cool blue, matches the new sidebar hue family

const RANGE_LABELS: Record<Range, string> = {
	"7d": "1W",
	"30d": "1M",
	"90d": "3M",
};

export type NetWorthHeroProps = {
	currency: string;
	netWorth: number;
	series: { date: Date; value: number }[];
	range: Range;
	onRangeChange: (range: Range) => void;
};

/**
 * Origin-style net-worth hero: a large headline number with the change over the
 * selected range, a gradient area chart, and the range toggle that drives both this
 * chart and the cashflow chart below. Spans the width the old net-worth / income /
 * expenses cards used to occupy.
 */
export function NetWorthHero({
	currency,
	netWorth,
	series,
	range,
	onRangeChange,
}: NetWorthHeroProps) {
	const first = series[0]?.value ?? netWorth;
	const last = series.at(-1)?.value ?? netWorth;
	const change = last - first;
	const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : undefined;
	const up = change >= 0;
	const TrendIcon = up ? TrendingUp : TrendingDown;

	const money = (value: number) =>
		new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 0,
		}).format(value);

	const moneyExact = (value: number) =>
		new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value);

	return (
		<Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
			<CardContent className="flex flex-1 flex-col gap-4 p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Net worth
						</div>
						<div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
							{money(netWorth)}
						</div>
						<div
							className={cn(
								"mt-1 flex items-center gap-1 text-sm font-medium tabular-nums",
								up
									? "text-emerald-600 dark:text-emerald-500"
									: "text-red-600 dark:text-red-500",
							)}
						>
							<TrendIcon className="size-4" />
							{up ? "+" : ""}
							{moneyExact(change)}
							{changePct !== undefined && (
								<span className="text-muted-foreground">
									({up ? "+" : ""}
									{changePct.toFixed(2)}%)
								</span>
							)}
						</div>
					</div>

					<ToggleGroup
						type="single"
						value={range}
						onValueChange={(next) => {
							if (next) onRangeChange(next as Range);
						}}
						variant="outline"
						size="sm"
						className="*:data-[slot=toggle-group-item]:px-3!"
					>
						{(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
							<ToggleGroupItem key={r} value={r}>
								{RANGE_LABELS[r]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				<div className="min-h-0 flex-1">
					<AreaChart
						aspectRatio="4 / 1"
						className="h-full w-full"
						data={series}
						margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
					>
						<Grid />
						<XAxis />
						<ChartTooltip
							backgroundColor="oklch(96.7% 0.001 286.375)"
							rows={(point) => [
								{
									color: HERO_STROKE,
									label: "Net worth",
									value: moneyExact(point.value as number),
								},
							]}
						/>
						<Area
							dataKey="value"
							stroke={HERO_STROKE}
							fill={HERO_STROKE}
							fillOpacity={0.18}
							strokeWidth={2}
							gradientToOpacity={0}
							showHighlight
						/>
					</AreaChart>
				</div>

				<div className="flex items-center justify-end">
					<Button variant="outline" size="sm" asChild>
						<Link to="/accounts">
							<Plus className="size-4" />
							Add account
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
