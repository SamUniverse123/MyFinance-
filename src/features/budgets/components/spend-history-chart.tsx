"use client";

import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BUDGET_TONE_FILL, budgetStatus } from "../budget-status";
import { useMonthDirection } from "../use-month-direction";

export interface SpendHistoryPoint {
	/** First day of the month, `YYYY-MM-DD`. */
	month: string;
	/** That month's total spend, in display units. */
	spent: number;
	/** That month's effective budget (display units), or null when unbudgeted. */
	budget: number | null;
}

const MARGIN = { top: 24, right: 12, bottom: 28, left: 12 };
const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: "short" });
const SLIDE_S = 0.32;
const SLOT_PADDING = 0.35; // fraction of a slot not occupied by the bar

function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	if (!y || !m) return month;
	return MONTH_FMT.format(new Date(y, m - 1, 1));
}

/** Content-derived key — the parent recreates `data`'s array/objects every render
 *  regardless of whether the values changed, so identity comparison would misfire. */
function dataKeyOf(data: SpendHistoryPoint[]): string {
	return data.map((d) => `${d.month}:${d.spent}:${d.budget}`).join("|");
}

function ChartInner({
	width,
	height,
	data,
	currency,
}: {
	width: number;
	height: number;
	data: SpendHistoryPoint[];
	currency: string;
}) {
	const reduceMotion = useReducedMotion();
	const [hovered, setHovered] = useState<number | null>(null);
	// 6 points at rest; briefly 7 (the union of the outgoing and incoming windows)
	// while a sliding-window transition is in flight (grill Q4).
	const [combined, setCombined] = useState<SpendHistoryPoint[]>(data);
	const [offsetX, setOffsetX] = useState(0);
	const prevDataRef = useRef(data);
	const prevKeyRef = useRef(dataKeyOf(data));
	// The selected month is always the last point — deriving direction from it here
	// keeps this chart in sync with the rest of the page without a prop (grill Q5).
	const direction = useMonthDirection(data[data.length - 1]?.month);

	const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
	const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
	const slotWidth = innerWidth / 6;

	// Hooks must run unconditionally, ahead of the width/height early-return below.
	useEffect(() => {
		const key = dataKeyOf(data);
		if (key === prevKeyRef.current) return;
		const prev = prevDataRef.current;
		prevKeyRef.current = key;
		prevDataRef.current = data;

		const prevMonths = prev.map((d) => d.month);
		const nextMonths = data.map((d) => d.month);
		// A "clean" ±1 shift: five of the six months carry over, in the same order.
		const isForwardShift =
			direction === "forward" &&
			prev.length === 6 &&
			data.length === 6 &&
			prevMonths.slice(1).every((m, i) => m === nextMonths[i]);
		const isBackwardShift =
			direction === "backward" &&
			prev.length === 6 &&
			data.length === 6 &&
			prevMonths.slice(0, -1).every((m, i) => m === nextMonths[i + 1]);

		// Anything else (currency switch, a background refetch, a non-adjacent month
		// jump, reduced motion, or a zero-width first paint) just snaps — no window to
		// slide, or nothing to correctly represent a slide from.
		if (
			reduceMotion ||
			innerWidth <= 0 ||
			(!isForwardShift && !isBackwardShift)
		) {
			setCombined(data);
			setOffsetX(0);
			return;
		}

		const merged = isForwardShift
			? [...prev, data[data.length - 1]]
			: [data[0], ...prev];
		setCombined(merged);

		// Snap to the start position (matching what was already on screen), then tween
		// to the settled one — the same imperative `animate()` pattern this project
		// already uses for chart tweening (see charts/use-animated-*.ts): drive plain
		// state via onUpdate rather than binding a MotionValue to the SVG element.
		const start = isForwardShift ? 0 : -slotWidth;
		const end = isForwardShift ? -slotWidth : 0;
		setOffsetX(start);
		const controls = animate(0, 1, {
			duration: SLIDE_S,
			ease: "easeInOut",
			onUpdate: (progress) => setOffsetX(start + (end - start) * progress),
			onComplete: () => {
				setCombined(data);
				setOffsetX(0);
			},
		});
		return () => controls.stop();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data, direction, reduceMotion, innerWidth, slotWidth]);

	if (width < 10 || height < 10) return null;

	const money = (v: number) =>
		new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 0,
		}).format(v);

	// Y-domain covers whatever's visible at any point during the transition (the
	// union), so the scale doesn't also jump vertically mid-slide.
	const maxSpent = Math.max(0, ...combined.map((d) => d.spent));
	const maxBudget = Math.max(0, ...combined.map((d) => d.budget ?? 0));
	const maxValue = Math.max(maxSpent, maxBudget, 1);

	const yScale = scaleLinear({
		range: [innerHeight, 0],
		domain: [0, maxValue * 1.15],
		nice: true,
	});

	const bandWidth = slotWidth * (1 - SLOT_PADDING);
	const slotX = (index: number) =>
		index * slotWidth + (slotWidth - bandWidth) / 2;

	// The trailing numeric label always reflects the true selected month (`data`'s
	// last point), never a mid-transition value — the number doesn't animate, only
	// the bars/line do.
	const lastBudget = data[data.length - 1]?.budget ?? null;
	const lastBudgetY = lastBudget != null ? yScale(lastBudget) : null;

	return (
		<svg width={width} height={height} role="img" aria-label="Monthly spending">
			<defs>
				<clipPath id="spend-history-clip">
					<rect x={0} y={-4} width={innerWidth} height={innerHeight + 34} />
				</clipPath>
			</defs>
			<g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
				<g
					clipPath="url(#spend-history-clip)"
					transform={`translate(${offsetX},0)`}
				>
					{/* Per-month budget reference line — a dashed segment across each month's
					    slot at that month's effective budget (ADR-0015). */}
					{combined.map((d, i) => {
						if (d.budget == null) return null;
						const center = i * slotWidth + slotWidth / 2;
						const y = yScale(d.budget);
						return (
							<line
								key={`budget-${d.month}`}
								x1={center - slotWidth / 2}
								x2={center + slotWidth / 2}
								y1={y}
								y2={y}
								stroke="var(--color-muted-foreground)"
								strokeWidth={1}
								strokeDasharray="4 4"
								opacity={0.6}
							/>
						);
					})}

					{combined.map((d, i) => {
						const x = slotX(i);
						const center = i * slotWidth + slotWidth / 2;
						const y = yScale(d.spent);
						const barHeight = Math.max(0, innerHeight - y);
						const status = budgetStatus(d.spent, d.budget);
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
									x={i * slotWidth}
									y={0}
									width={slotWidth}
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
										x={center}
										y={y - 6}
										textAnchor="middle"
										className="fill-foreground text-[11px] font-medium tabular-nums"
									>
										{money(d.spent)}
									</text>
								)}
								<text
									x={center}
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

				{/* Drawn outside the sliding/clipped group — the label reflects the settled
				    target the whole way through, never a mid-slide value (see above). */}
				{lastBudgetY != null && lastBudget != null && (
					<text
						x={innerWidth}
						y={lastBudgetY - 4}
						textAnchor="end"
						className="fill-muted-foreground text-[10px] tabular-nums"
					>
						{money(lastBudget)}
					</text>
				)}
			</g>
		</svg>
	);
}

/** 6-month spend history as bars, colored by the same budget thresholds as the bars,
 *  with a dashed line at the current budget (ADR-0010). Self-contained: visx scales,
 *  no dependency on the interactive chart shell. A month-to-month change slides the
 *  window rather than tweening bars in place (grill Q4) — the underlying 6-month set
 *  genuinely shifts, it doesn't just re-value. */
export function SpendHistoryChart({
	data,
	currency,
	aspectRatio = "5 / 2",
}: {
	data: SpendHistoryPoint[];
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
						currency={currency}
					/>
				)}
			</ParentSize>
		</div>
	);
}
