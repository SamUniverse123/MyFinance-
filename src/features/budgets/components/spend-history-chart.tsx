"use client";

import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useState } from "react";
import { BUDGET_TONE_FILL, budgetStatus } from "../budget-status";

export interface SpendHistoryPoint {
	/** First day of the month, `YYYY-MM-DD`. */
	month: string;
	/** That month's total spend, in display units. */
	spent: number;
}

const MARGIN = { top: 24, right: 12, bottom: 28, left: 12 };
const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: "short" });

function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	if (!y || !m) return month;
	return MONTH_FMT.format(new Date(y, m - 1, 1));
}

function ChartInner({
	width,
	height,
	data,
	budget,
	currency,
}: {
	width: number;
	height: number;
	data: SpendHistoryPoint[];
	budget: number | null;
	currency: string;
}) {
	const [hovered, setHovered] = useState<number | null>(null);

	if (width < 10 || height < 10) return null;

	const innerWidth = width - MARGIN.left - MARGIN.right;
	const innerHeight = height - MARGIN.top - MARGIN.bottom;

	const money = (v: number) =>
		new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 0,
		}).format(v);

	const maxSpent = Math.max(0, ...data.map((d) => d.spent));
	const maxValue = Math.max(maxSpent, budget ?? 0, 1);

	const xScale = scaleBand({
		range: [0, innerWidth],
		domain: data.map((d) => d.month),
		padding: 0.35,
	});
	const yScale = scaleLinear({
		range: [innerHeight, 0],
		domain: [0, maxValue * 1.15],
		nice: true,
	});

	const budgetY = budget != null ? yScale(budget) : null;

	return (
		<svg width={width} height={height} role="img" aria-label="Monthly spending">
			<g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
				{/* Budget threshold line */}
				{budgetY != null && (
					<g>
						<line
							x1={0}
							x2={innerWidth}
							y1={budgetY}
							y2={budgetY}
							stroke="var(--color-muted-foreground)"
							strokeWidth={1}
							strokeDasharray="4 4"
							opacity={0.6}
						/>
						<text
							x={innerWidth}
							y={budgetY - 4}
							textAnchor="end"
							className="fill-muted-foreground text-[10px] tabular-nums"
						>
							{money(budget as number)}
						</text>
					</g>
				)}

				{data.map((d, i) => {
					const x = xScale(d.month) ?? 0;
					const bandWidth = xScale.bandwidth();
					const step = xScale.step();
					const center = x + bandWidth / 2;
					const y = yScale(d.spent);
					const barHeight = Math.max(0, innerHeight - y);
					const status = budgetStatus(d.spent, budget);
					const fill = BUDGET_TONE_FILL[status.barColor];
					const isHovered = hovered === i;
					const dim = hovered != null && !isHovered ? 0.4 : 1;

					return (
						<g
							key={d.month}
							opacity={dim}
							style={{ transition: "opacity 0.15s ease-in-out" }}
							onMouseEnter={() => setHovered(i)}
							onMouseLeave={() => setHovered(null)}
						>
							{/* Full-slot hover target so thin bars stay easy to hover */}
							<rect
								x={center - step / 2}
								y={0}
								width={step}
								height={innerHeight}
								fill="transparent"
							/>
							{barHeight > 0 && (
								<rect
									x={x}
									y={y}
									width={bandWidth}
									height={barHeight}
									rx={3}
									ry={3}
									fill={fill}
								/>
							)}
							{isHovered && (
								<text
									x={x + bandWidth / 2}
									y={y - 6}
									textAnchor="middle"
									className="fill-foreground text-[11px] font-medium tabular-nums"
								>
									{money(d.spent)}
								</text>
							)}
							<text
								x={x + bandWidth / 2}
								y={innerHeight + 18}
								textAnchor="middle"
								className="fill-muted-foreground text-[11px]"
							>
								{monthLabel(d.month)}
							</text>
						</g>
					);
				})}
			</g>
		</svg>
	);
}

/** 6-month spend history as bars, colored by the same budget thresholds as the bars,
 *  with a dashed line at the current budget (ADR-0010). Self-contained: visx scales,
 *  no dependency on the interactive chart shell. */
export function SpendHistoryChart({
	data,
	budget,
	currency,
	aspectRatio = "5 / 2",
}: {
	data: SpendHistoryPoint[];
	budget: number | null;
	currency: string;
	aspectRatio?: string;
}) {
	return (
		<div className="w-full" style={{ aspectRatio }}>
			<ParentSize debounceTime={10}>
				{({ width, height }) => (
					<ChartInner
						width={width}
						height={height}
						data={data}
						budget={budget}
						currency={currency}
					/>
				)}
			</ParentSize>
		</div>
	);
}
