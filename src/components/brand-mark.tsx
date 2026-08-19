import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/*
 * <BrandMark> — the interactive Denarii logo (ADR-0016).
 *
 * Three coins (gold, silver, brass) seen edge-on and stacked flush at rest, with
 * the "Denarii" wordmark to their right. When active (hover / autoplay / toggle)
 * the coins fan out and each spins to face-on, settling gold → silver → brass,
 * while the wordmark fades. Reversing is automatic when `active` drops.
 *
 * Prop-driven on purpose: it takes `expanded`/`autoPlay` rather than reading the
 * sidebar, so it previews in isolation and reuses on the auth pages.
 *
 * Motion notes: coins animate via independent transforms (rotateY + x) because
 * each coin has its own duration; willChange is set on the moving layers; nothing
 * reads a MotionValue during render; the tween is interruptible.
 */

type Metal = {
	name: string;
	/** Face gradient (the milled disc). */
	face: string;
	/** Rim edge highlights (edge-on lens). */
	rimLight: string;
	rimDark: string;
	/** Dark accent for reeding + emblem (embossed look). */
	ink: string;
	/** Seconds to spin-and-settle — ascending, so gold stops first, brass last. */
	settle: number;
};

const METALS: Metal[] = [
	{
		name: "gold",
		face: "radial-gradient(circle at 32% 28%, #fff6d5, #f2cf6b 42%, #d19a2b 78%, #a9741a)",
		rimLight: "#f2cf6b",
		rimDark: "#a9741a",
		ink: "#7a4e12",
		settle: 0.55,
	},
	{
		name: "silver",
		face: "radial-gradient(circle at 32% 28%, #ffffff, #d7dce2 42%, #a3aab3 78%, #7c828b)",
		rimLight: "#dfe4ea",
		rimDark: "#7c828b",
		ink: "#565c65",
		settle: 0.8,
	},
	{
		name: "brass",
		face: "radial-gradient(circle at 32% 28%, #f6e6b8, #d3ab55 42%, #a67c2e 78%, #7c5a1f)",
		rimLight: "#d3ab55",
		rimDark: "#7c5a1f",
		ink: "#5f451a",
		settle: 1.05,
	},
];

/** Dense horizontal reeding across the edge strip (viewBox y positions). Seen
 *  edge-on, a coin's knurled ridges stack down the strip as fine rungs, each
 *  paired with a highlight below for a corrugated metallic look. */
const EDGE_RIDGES = Array.from({ length: 22 }, (_, i) => 6 + i * 4);

/** Reeding ticks around the face edge — few and bold, so they still read once
 *  the coin has shrunk to icon scale (unlike a fine-lined mill pattern). */
const FACE_TICKS = Array.from({ length: 20 }, (_, i) => {
	const a = (i / 20) * Math.PI * 2;
	const cos = Math.cos(a);
	const sin = Math.sin(a);
	return {
		x1: 50 + cos * 42,
		y1: 50 + sin * 42,
		x2: 50 + cos * 48,
		y2: 50 + sin * 48,
	};
});

/** A rough, simplified right-facing laureate profile (viewBox 100×100) — bold
 *  enough as a single filled silhouette to read at icon scale, unlike a
 *  fine-lined portrait. */
const PROFILE =
	"M42 20 C 55 18 66 27 65 38 C 69 40 71 44 69 48 C 73 50 72 55 68 56 C 70 60 67 64 62 64 L 60 76 C 60 82 55 86 48 86 L 40 86 L 40 66 C 28 63 24 50 30 40 C 27 32 33 22 42 20 Z";

export type BrandMarkProps = {
	/** Expanded lockup (coins + wordmark, room to fan out) vs. collapsed icon. */
	expanded?: boolean;
	/** Play the flourish once on mount (auth pages / first app-shell entry). */
	autoPlay?: boolean;
	/** Change this value to replay the flourish once (e.g. on sidebar toggle). */
	playSignal?: number;
	/** Coin diameter in px. */
	size?: number;
	className?: string;
};

export function BrandMark({
	expanded = true,
	autoPlay = false,
	playSignal,
	size = 26,
	className,
}: BrandMarkProps) {
	const reduce = useReducedMotion();
	const [hovered, setHovered] = useState(false);
	const [autoActive, setAutoActive] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	// A self-contained flourish: fan out, then settle back after a hold. Skipped
	// under reduced motion (ADR-0016 — no unprompted movement).
	const play = useCallback(() => {
		if (reduce) return;
		setAutoActive(true);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setAutoActive(false), 1400);
	}, [reduce]);

	// Autoplay once on mount (auth pages).
	useEffect(() => {
		if (autoPlay) play();
	}, [autoPlay, play]);

	// Replay whenever `playSignal` changes — but not on the initial render.
	// playSignal is a trigger-only dependency: its value is never read, only its
	// identity change matters, which the exhaustive-deps rule can't tell apart
	// from a genuinely unused dependency.
	const firstSignal = useRef(true);
	// biome-ignore lint/correctness/useExhaustiveDependencies: playSignal is a deliberate trigger-only dep (see comment above).
	useEffect(() => {
		if (firstSignal.current) {
			firstSignal.current = false;
			return;
		}
		play();
	}, [playSignal, play]);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	const active = hovered || autoActive;
	// Spread needs room and is suppressed under reduced motion (no translation).
	const canSpread = expanded && !reduce;

	// Geometry — all derived from `size`. Chunky edges (not slivers) so three
	// distinct coins read at rest, even at icon scale.
	const rimW = size * 0.36;
	const stackStep = rimW * 0.96; // flush — a hairline overlap, not a heavy one
	const spreadStep = size * 1.06; // fanned-out spacing
	const spreadDelta = active && canSpread ? spreadStep - stackStep : 0;
	const fieldW = rimW + stackStep * 2; // stacked footprint (coins overflow when fanning)
	const faceLeft = (rimW - size) / 2; // center the disc over its rim

	return (
		<div
			className={className}
			onPointerEnter={(e) => {
				if (e.pointerType !== "touch") setHovered(true);
			}}
			onPointerLeave={() => setHovered(false)}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: size * 0.16, // wordmark sits close to the stack
				userSelect: "none",
			}}
		>
			{/* Coin field — stacked width; coins overflow visibly when they fan out. */}
			<div
				style={{
					position: "relative",
					width: fieldW,
					height: size,
					perspective: size * 20,
					overflow: "visible",
					flex: "none",
				}}
			>
				{METALS.map((metal, i) => {
					const transition = reduce
						? { duration: 0.25 }
						: { duration: metal.settle, ease: [0.2, 0.7, 0.2, 1] as const };
					return (
						<motion.div
							key={metal.name}
							initial={false}
							animate={{ x: i * spreadDelta }}
							transition={transition}
							style={{
								position: "absolute",
								top: 0,
								left: i * stackStep,
								width: rimW,
								height: size,
								transformStyle: "preserve-3d",
								willChange: active ? "transform" : "auto",
							}}
						>
							{/* Edge: rounded rim with knurled reeding, shown at rest.
							    Crossfades to the face in both modes. */}
							<motion.div
								initial={false}
								animate={{ opacity: active ? 0 : 1 }}
								transition={transition}
								style={{ position: "absolute", inset: 0 }}
							>
								<CoinEdge metal={metal} />
							</motion.div>

							{/* Face: milled disc, spun in from edge-on (a plain in-place
							    crossfade under reduced motion — no spin). */}
							<motion.div
								initial={false}
								animate={{
									rotateY: reduce ? 0 : active ? -360 : 90,
									opacity: active ? 1 : 0,
								}}
								transition={transition}
								style={{
									position: "absolute",
									top: 0,
									left: faceLeft,
									width: size,
									height: size,
									borderRadius: "50%",
									background: metal.face,
									boxShadow:
										"inset 0 0 0 1.5px rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.35)",
									backfaceVisibility: "visible",
									willChange: active ? "transform, opacity" : "auto",
								}}
							>
								<FaceDetail color={metal.ink} />
							</motion.div>
						</motion.div>
					);
				})}
			</div>

			{/* Wordmark — present only when expanded; fades as the coins fan out. */}
			{expanded && (
				<motion.span
					initial={false}
					animate={{
						opacity: active ? 0 : 1,
						x: reduce || !active ? 0 : size * 0.3,
					}}
					transition={reduce ? { duration: 0.2 } : { duration: 0.35 }}
					style={{
						fontFamily: "var(--font-display, 'Fraunces', Georgia, serif)",
						// Augustus's caps run tall relative to its declared size, so this
						// sits well under `size` to stay visually balanced against the coins.
						fontSize: size * 0.62,
						lineHeight: 1,
						fontWeight: 400,
						letterSpacing: "0.01em",
						whiteSpace: "nowrap",
					}}
				>
					Denarii
				</motion.span>
			)}
		</div>
	);
}

/** The coin edge: a rounded rim filled with a metal gradient + dense knurled reeding.
 *  Fills whatever box its (absolutely positioned) parent gives it. */
function CoinEdge({ metal }: { metal: Metal }) {
	const gradId = `rim-${metal.name}`;
	const clipId = `rimclip-${metal.name}`;
	return (
		<svg
			viewBox="0 0 24 100"
			preserveAspectRatio="none"
			// width/height set via CSS (not attributes) so they can't be overridden by
			// ancestor rules that target `svg` — the sidebar's [&_svg]:size-4 does
			// exactly that, and CSS always wins over SVG presentation attributes.
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
			}}
			aria-hidden="true"
		>
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor={metal.rimDark} />
					<stop offset="0.45" stopColor={metal.rimLight} />
					<stop offset="1" stopColor={metal.rimDark} />
				</linearGradient>
				<clipPath id={clipId}>
					<rect x="3" y="2" width="18" height="96" rx="4" ry="7" />
				</clipPath>
			</defs>
			<rect
				x="3"
				y="2"
				width="18"
				height="96"
				rx="4"
				ry="7"
				fill={`url(#${gradId})`}
				stroke={metal.ink}
				strokeOpacity="0.5"
				strokeWidth="1"
				vectorEffect="non-scaling-stroke"
			/>
			
		</svg>
	);
}

/** Face detail: bold reeding ticks + a simplified laureate profile, sized to
 *  stay legible once the coin has shrunk to icon scale. */
function FaceDetail({ color }: { color: string }) {
	return (
		<svg
			viewBox="0 0 100 100"
			style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
			aria-hidden="true"
		>
			<g stroke={color} strokeOpacity="0.5" strokeWidth="2.5">
				{FACE_TICKS.map((t) => (
					<line
						key={`${t.x1.toFixed(1)}-${t.y1.toFixed(1)}`}
						x1={t.x1}
						y1={t.y1}
						x2={t.x2}
						y2={t.y2}
					/>
				))}
			</g>
			<circle
				cx="50"
				cy="50"
				r="38"
				fill="none"
				stroke={color}
				strokeOpacity="0.45"
				strokeWidth="2"
			/>
			{/* <path d={PROFILE} fill={color} fillOpacity="0.62" /> */}
		</svg>
	);
}
