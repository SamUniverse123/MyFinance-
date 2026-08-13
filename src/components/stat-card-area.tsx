"use client";

import { curveCardinal } from "@visx/curve";
import { useState } from "react";
import {
	Area,
	AreaChart,
	ChartStatFlow,
	type ChartStatFlowFormat,
} from "@/components/charts";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	StatCardChart,
	statCardLabelClassName,
	statCardValueClassName,
} from "./stat-card-chart";
import {
	formatStatCardDay,
	StatCardHoverBridge,
	type StatCardHoverState,
} from "./stat-card-hover-bridge";
import { TrendBadge } from "./trend-badge";

/**
 * Adapted from `@bklit/stat-card-area-01` (docs/adr/0008): the upstream block
 * hardcodes a "Total Revenue" title and fake `revenueSeries`/`revenueStats` data.
 * This version takes the title, series, headline value, and trend as props so it
 * can render any of the dashboard's stat tiles (net worth, income, expenses,
 * cashflow) against real data.
 */
export function StatCardArea({
	title,
	data,
	value,
	trend,
	formatOptions,
}: {
	title: string;
	data: { date: Date; value: number }[];
	value: number;
	trend?: number;
	formatOptions?: ChartStatFlowFormat;
}) {
	const [hover, setHover] = useState<StatCardHoverState>({
		value: null,
		label: null,
		trend: null,
	});
	const displayValue = hover.value ?? value;
	const displayLabel = hover.label ?? "Total";
	const displayTrend = hover.trend ?? trend;

	return (
		<Card className="w-full gap-0 py-0">
			<CardHeader className="px-4 py-3">
				<CardTitle>{title}</CardTitle>
				{displayTrend !== undefined && (
					<CardAction>
						<TrendBadge value={displayTrend} />
					</CardAction>
				)}
			</CardHeader>

			<CardContent className="flex flex-col gap-3 px-4 pt-2 pb-3">
				<ChartStatFlow
					formatOptions={formatOptions}
					label={displayLabel}
					labelClassName={statCardLabelClassName}
					value={displayValue}
					valueClassName={statCardValueClassName}
				/>

				<StatCardChart size="md">
					<AreaChart
						aspectRatio="2.5 / 1"
						className="w-full"
						data={data}
						margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
					>
						<StatCardHoverBridge
							dataKey="value"
							formatLabel={formatStatCardDay}
							onHoverChange={setHover}
						/>
						<Area
							curve={curveCardinal.tension(0.65)}
							dataKey="value"
							fillOpacity={1}
							gradientToOpacity={0}
							showHighlight
							stroke="var(--chart-1)"
							strokeWidth={2}
						/>
					</AreaChart>
				</StatCardChart>
			</CardContent>
		</Card>
	);
}
