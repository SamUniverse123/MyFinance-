"use client";

import { curveBasis } from "@visx/curve";
import { useState } from "react";
import {
	ChartStatFlow,
	type ChartStatFlowFormat,
	Line,
	LineChart,
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
 * Adapted from `@bklit/stat-card-line-01` (docs/adr/0008) — same generalization
 * as `stat-card-area.tsx`: props instead of hardcoded "Active Sessions" demo data.
 */
export function StatCardLine({
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

			<CardContent className="px-4 pt-2 pb-3">
				<StatCardChart size="md">
					<div className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-col items-end text-right">
						<ChartStatFlow
							formatOptions={formatOptions}
							label={displayLabel}
							labelClassName={statCardLabelClassName}
							value={displayValue}
							valueClassName={statCardValueClassName}
						/>
					</div>

					<LineChart
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
						<Line
							curve={curveBasis}
							dataKey="value"
							showHighlight
							stroke="var(--chart-3)"
							strokeWidth={2.5}
						/>
					</LineChart>
				</StatCardChart>
			</CardContent>
		</Card>
	);
}
