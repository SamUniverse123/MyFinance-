import { useMemo } from "react";
import { Ring } from "#/components/charts/ring";
import type { RingData } from "#/components/charts/ring-context";
import { RingChart } from "#/components/charts/ring-chart";
import { getCategoryColor } from "#/features/categories/category-visuals";
import { formatMoney } from "#/lib/currency";
import type { BudgetCategory } from "../api";

// Ring geometry adapts to the number of rings so the outermost ring always reaches
// the same outer radius (filling the box): with few categories the rings are thick,
// and they get progressively thinner — shifting inward — as more are added. Because
// bklit scales the design radii to fit the container, only the *ratios* here matter.
const DESIGN_OUTER = 175; // target outer radius (design units)
const BASE_INNER = 70; // center hole radius, held constant so the label stays readable
const RING_BAND = DESIGN_OUTER - BASE_INNER;

function ringGeometry(count: number): {
	strokeWidth: number;
	ringGap: number;
	baseInnerRadius: number;
} {
	const perRing = RING_BAND / Math.max(count, 1);
	const ringGap = Math.min(8, Math.max(2, perRing * 0.25));
	const strokeWidth = Math.max(4, perRing - ringGap);
	return { strokeWidth, ringGap, baseInnerRadius: BASE_INNER };
}

/**
 * Ring chart of budget usage — one ring per budgeted category, arc = spent/budget
 * (clamped to a full ring when over, ADR-0010). Hover is lifted to the parent via
 * `hoveredId` / `onHoverChange` so the rings and the category widgets cross-highlight.
 * The center is rendered as an overlay (not the bklit RingCenter) so it can show the
 * total money spent even where a ring's arc is clamped.
 */
export function CategoryRingChart({
	categories,
	currency,
	totalSpent,
	hoveredId,
	onHoverChange,
}: {
	/** Budgeted categories only (each has a non-null `budget`). */
	categories: BudgetCategory[];
	currency: string;
	/** Total money spent this month (minor units) — the default center figure. */
	totalSpent: number;
	hoveredId: string | null;
	onHoverChange: (id: string | null) => void;
}) {
	const ringData = useMemo<RingData[]>(
		() =>
			categories.map((c) => {
				const budget = c.budget as number;
				return {
					label: c.name,
					// Clamp the arc to the budget so an over-budget ring reads as "maxed"
					// rather than overshooting a full circle.
					value: Math.min(c.spent, budget),
					maxValue: budget,
					color: getCategoryColor(c.color),
				};
			}),
		[categories],
	);

	const { strokeWidth, ringGap, baseInnerRadius } = ringGeometry(
		categories.length,
	);

	const hoveredIndex = hoveredId
		? categories.findIndex((c) => c.id === hoveredId)
		: -1;
	const controlledIndex = hoveredIndex >= 0 ? hoveredIndex : null;

	const hoveredCategory = hoveredIndex >= 0 ? categories[hoveredIndex] : null;
	const centerValue = hoveredCategory ? hoveredCategory.spent : totalSpent;
	const centerLabel = hoveredCategory ? hoveredCategory.name : "spent";

	return (
		<div className="relative mx-auto w-full max-w-[340px]">
			<RingChart
				data={ringData}
				hoveredIndex={controlledIndex}
				onHoverChange={(index) =>
					onHoverChange(index == null ? null : (categories[index]?.id ?? null))
				}
				strokeWidth={strokeWidth}
				ringGap={ringGap}
				baseInnerRadius={baseInnerRadius}
			>
				{ringData.map((ring, i) => (
					// showGlow off: the hover glow (a colored drop-shadow) otherwise lingers
					// as a halo when adding a budget leaves the hover state on that ring.
					<Ring
						key={categories[i].id}
						index={i}
						color={ring.color}
						showGlow={false}
					/>
				))}
			</RingChart>

			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
				<div className="max-w-[55%] truncate text-2xl font-semibold tabular-nums">
					{formatMoney(centerValue, currency)}
				</div>
				<div className="max-w-[55%] truncate text-xs text-muted-foreground">
					{centerLabel}
				</div>
			</div>
		</div>
	);
}
